-- ============================================================
-- NEXTRUM — en person går att radera ur adminvyn
--
-- Leo 2026-09-28: "vi ska kunna radera personen från våra system med
-- en knapp där ifall personen inte ska anställas eller om personen
-- inte vill senare ha vår tjänst."
--
-- Knappen fanns inte, och det gick inte att göra rätt för hand heller.
-- leads, applications och profiles har ingen DELETE-policy, och ett
-- konto som togs bort i dashboarden tog med sig sina betalda pass:
-- bookings.parent_id är ON DELETE CASCADE. En familj med ett klippkort
-- gick inte att ta bort alls (klippkort_parent_id_fkey är RESTRICT),
-- och en studiehjälpare med en rapport inte heller. Rutinen i
-- DATASKYDD.md avsnitt 6 ("radera allt utom bokföringen") fanns bara
-- på papperet.
--
--
-- TVÅ SÄTT, OCH DATABASEN VÄLJER
--
--   helt            ingenting om personen bär bokföring. Inloggningen
--                   (auth.users) tas bort, och kontot, barnen, passen,
--                   chatten och resten följer med genom de främmande
--                   nycklarna.
--   avidentifieras  personen har pass som hållits eller betalats,
--                   klippkort, fakturor, rapporter eller underlag. Det
--                   som är bokföring står kvar i sju år, men inget i det
--                   pekar ut vem det gällde: kontot heter "Raderad
--                   familj", adressen, telefonen och profilbilden är
--                   borta, barnen heter "Raderad elev" och har inga
--                   uppgifter, rapporternas text är tömd, platsen och
--                   raden till studiehjälparen på passen är tömda, och
--                   chatten, läxorna, studieplanerna och
--                   kunskapsområdena är borta. Raden i auth.users står
--                   kvar, för profiles.id pekar på den, men den stängs
--                   som GoTrues egen mjuka radering gör: adressen,
--                   lösenordet, identiteterna och sessionerna bort,
--                   deleted_at satt.
--
-- Vad som räknas som bokföring står i intern.passet_bar_bokforing(),
-- och bara där. Hellre ett pass för mycket än ett för lite: ett pass
-- som stått kvar i onödan kostar ingenting, en betalning som
-- försvunnit går inte att hitta igen.
--
-- Anmälningar avidentifieras som i nattjobbet, i stället för att tas
-- bort, så att statistiken räknar lika många bakåt i tiden (CLAUDE.md
-- avsnitt 5). Ansökningar och kontaktmeddelanden tas bort. Allt som
-- har samma adress (intern.epost_nyckel) följer med: det är personen
-- som raderas, inte en rad.
--
--
-- HINDER: PENGAR SOM INTE ÄR UPPGJORDA
--
-- En radering får aldrig få pengar att försvinna tyst. Det vi är
-- skyldiga personen, och det en studiehjälpare väntar på lön för, ska
-- vara avgjort först. radera_person() vägrar så länge något av det
-- här finns, och radering_lage() säger vad:
--
--   betalt_ej_hallet   betalt med kort, timmar eller timbanken, men
--                      varken hållet eller betalt tillbaka
--   timmar_kvar        ett giltigt klippkort med värde kvar om de
--                      slutar i dag (ångerfristens belopp inom fristen)
--   timbank_kvar       minuter i timbanken
--   kassa_oppen        ett köp av timmar står öppet i Stripes kassa
--                      (ett dygn); betalas det efteråt har kontot inget
--                      att betala tillbaka till
--   tvist_oppen        en korttvist är inte avgjord, och rapporten är
--                      beviset
--   betalt_for_lange   betalt med kort för mer tid än passet höll
--   ej_rapporterat     ett bekräftat pass har börjat men saknar
--                      rapport; studiehjälparen får lön först när
--                      rapporten finns, och den går inte att skriva för
--                      ett barn som inte längre är matchat
--   matchade_elever    (studiehjälpare) elever som ska matchas om först
--   kommande_betalda   (studiehjälpare) kommande pass som en familj
--                      betalat med kort
--
-- Pengar personen är skyldig OSS hindrar inte. De står i rutan som
-- larm ur avvikelser_rader(), och admin bestämmer.
--
--
-- KOMMANDE PASS AVBOKAS, OCH MOTPARTEN FÅR VETA DET
--
-- Obetalda pass som inte börjat avbokas i samma transaktion, med
-- skälet familjen_avslutar (familj, barn) eller ingen_hjalpare
-- (studiehjälpare). notis_vid_pass köar mejlet till motparten. Den som
-- raderas får inget: raderad_at sätts först, och notis_vill() svarar
-- nej för ett raderat konto. Utan avbokningen hade en studiehjälpare
-- haft kvar pass med en familj som inte finns.
--
--
-- FILEN FÖRST, RADEN SEDAN — OCH DATABASEN VAKTAR ORDNINGEN
--
-- storage.objects går inte att ta bort ur med SQL
-- (protect_objects_delete). radering_lage() svarar med filerna:
-- profilbilden, barnens mapp i hinken material och CV:n. Adminvyn tar
-- bort dem genom Storage-API:t och läser svaret, och radera_person()
-- vägrar så länge någon av dem finns kvar. Samma ordning som
-- ansokan_gallra(). Admin får därför ta bort i hinkarna cv och
-- avatarer, som material redan hade.
--
--
-- SÄKERHET
--
-- Båda dörrarna är SECURITY DEFINER och prövar is_admin() på första
-- raden. Ett adminkonto raderas inte här, inte heller ens eget. Varje
-- radering får en rad i auditloggen, utan namn: vem, när, sättet och
-- antalen.
--
-- Den som avidentifieras kan ha en giltig JWT kvar i upp till en
-- timme. Sessionerna och uppdateringsnycklarna är borta, så ingen ny
-- utfärdas, och kontot har inga barn och inga kommande pass kvar att
-- göra något med. Det är samma lucka som GoTrues egen radering har.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Markeringen
-- ------------------------------------------------------------
alter table public.profiles add column if not exists raderad_at timestamptz;
alter table public.students add column if not exists raderad_at timestamptz;

comment on column public.profiles.raderad_at is
  'Satt när kontot avidentifierats av radera_person(). Raden står kvar för bokföringens skull; '
  'adminvyn visar den inte i listorna, och notis_vill() svarar nej.';
comment on column public.students.raderad_at is
  'Satt när barnet avidentifierats av radera_person(). Raden står kvar för rapporternas och '
  'passens skull; familjen ser den inte längre.';

-- Markeringen sätts bara av databasen och av admin. Kunde en familj
-- sätta den på sig själv hade den försvunnit ur adminvyns listor med
-- kontot i full drift, och kunde den ta bort den hade ett raderat barn
-- kommit tillbaka.
do $$
declare
  f      text;
  def    text;
  n      int;
  gammal constant text := 'new.id               := old.id;';
  ny     constant text := 'new.id               := old.id;' || E'\n  new.raderad_at       := old.raderad_at;';
begin
  foreach f in array array['public.skydda_profilfalt()', 'public.skydda_studentfalt()'] loop
    def := pg_get_functiondef(f::regprocedure);
    n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
    if n <> 1 then
      raise exception '% har % rader "%", väntat en', f, n, gammal;
    end if;
    execute replace(def, gammal, ny);
  end loop;
end $$;

-- Familjen ser inte ett raderat barn. Via policyn och inte i vyn, så
-- att det också gäller läxorna, rapporterna och materialet, vars
-- policyer frågar students.
drop policy if exists "förälder ser egna barn" on public.students;
create policy "förälder ser egna barn" on public.students
  for select using (auth.uid() = parent_id and raderad_at is null);


-- ------------------------------------------------------------
-- 2. Admin tar bort CV:n och profilbilder
--
-- Filen först: adminvyn tar bort den genom Storage-API:t innan
-- radera_person() tar raden. Hinken material hade redan regeln.
-- ------------------------------------------------------------
drop policy if exists "admin tar bort cv" on storage.objects;
create policy "admin tar bort cv" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cv' and public.is_admin());

drop policy if exists "admin tar bort profilbilder" on storage.objects;
create policy "admin tar bort profilbilder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatarer' and public.is_admin());


-- ------------------------------------------------------------
-- 3. Tre befintliga funktioner lappas, var med en vakt
--
-- Läst ur driften, inte ur grenen (CLAUDE.md avsnitt 5): texten byts
-- med replace() och vakten räknar att den hittades exakt en gång. Har
-- någon annan ändrat funktionen under tiden faller migrationen, i
-- stället för att skriva över den andras ändring.
-- ------------------------------------------------------------

-- 3a. Låset för en stängd månad släpper igenom att platsen och raden
-- till studiehjälparen töms. De är inte bokföring, och en hemadress
-- ska inte stå kvar i sju år för att passet gör det. Bara tömning, och
-- bara när inget annat på passet ändras.
do $$
declare
  def    text;
  n      int;
  gammal constant text := $g$if tg_table_name = 'bookings' then$g$;
  ny     constant text := $n$if tg_table_name = 'bookings' then
    -- personer_redigeras_och_raderas: tömningen vid en radering.
    if tg_op = 'UPDATE' then
      if new.location is null and new.note is null
         and (to_jsonb(new) - 'location' - 'note') = (to_jsonb(old) - 'location' - 'note') then
        return new;
      end if;
    end if;$n$;
begin
  def := pg_get_functiondef('intern.las_stangd_manad()'::regprocedure);
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if n <> 1 then
    raise exception 'intern.las_stangd_manad har % rader "%", väntat en', n, gammal;
  end if;
  execute replace(def, gammal, ny);
end $$;

-- 3b. Ett raderat konto vill inga notiser. En saknad rad i notis_val
-- betyder annars PÅ, och påminnelsen om timmar som går ut
-- (timmar_gar_ut_koa) hade köat ett mejl till ett konto utan adress.
do $$
declare
  def    text;
  n      int;
  gammal constant text := 'select coalesce(';
  ny     constant text := 'select not exists (select 1 from public.profiles r'
                          || ' where r.id = p_profil and r.raderad_at is not null)'
                          || E'\n     and coalesce(';
begin
  def := pg_get_functiondef('public.notis_vill(uuid, text, text)'::regprocedure);
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if n <> 1 then
    raise exception 'public.notis_vill har % rader "%", väntat en', n, gammal;
  end if;
  execute replace(def, gammal, ny);
end $$;

-- 3c. Ett konto som redan är raderat blir aldrig "oanvänt i två år".
do $$
declare
  def    text;
  n      int;
  gammal constant text := 'where not coalesce(p.is_admin, false)';
  ny     constant text := 'where not coalesce(p.is_admin, false)' || E'\n       and p.raderad_at is null';
begin
  def := pg_get_functiondef('intern.konton_oanvanda()'::regprocedure);
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if n <> 1 then
    raise exception 'intern.konton_oanvanda har % rader "%", väntat en', n, gammal;
  end if;
  execute replace(def, gammal, ny);
end $$;


-- ------------------------------------------------------------
-- 4. Hjälparna
-- ------------------------------------------------------------

-- Har passet börjat? Svensk tid, som allt annat om pass. Ett pass utan
-- datum räknas som börjat: det som inte går att placera avbokas inte.
create or replace function intern.passet_har_borjat(b public.bookings)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(b.wanted_date + coalesce(b.wanted_time, '00:00')::time
                  <= (now() at time zone 'Europe/Stockholm'), true)
$$;

-- Betalt och varken hållet eller betalt tillbaka. Med kort, med timmar
-- (betalt_ore 0) eller med timbanken.
create or replace function intern.passet_betalt_ej_hallet(b public.bookings)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select b.status <> 'completed'
     and b.betalning_status in ('betald', 'tvist')
     and not (coalesce(b.betalt_ore, 0) > 0 and coalesce(b.aterbetald_ore, 0) >= b.betalt_ore)
$$;

-- Bär passet bokföring? Då står det kvar, och personen avidentifieras
-- i stället för att tas bort. Ett pass i en stängd månad räknas också:
-- låset hade nekat borttagningen, och det låset är till för just det.
create or replace function intern.passet_bar_bokforing(b public.bookings)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select b.status = 'completed'
      or coalesce(b.betalning_status, 'ingen') <> 'ingen'
      or b.betalt_ore is not null or b.begart_ore is not null
      or b.klippkort_id is not null
      or b.stripe_session_id is not null or b.stripe_payment_intent_id is not null
      or b.stripe_charge_id is not null
      or intern.manad_stangd(b.wanted_date)
      or exists (select 1 from public.lesson_reports r where r.booking_id = b.id)
      or exists (select 1 from public.timbank_uttag u where u.booking_id = b.id)
      or exists (select 1 from public.pass_tillagg t where t.booking_id = b.id)
      or exists (select 1 from public.invoice_lines l where l.booking_id = b.id)
      or exists (select 1 from public.payout_lines l where l.booking_id = b.id)
      or exists (select 1 from public.stripe_tvister t where t.booking_id = b.id)
$$;

-- Personens adress som nyckel (intern.epost_nyckel), eller null.
-- "gallrad" är en avidentifierad anmälan och ingen adress.
create or replace function intern.radering_nyckel(p_typ text, p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(nullif(intern.epost_nyckel(case p_typ
    when 'anmalan' then (select l.email from public.leads l where l.id = p_id)
    when 'ansokan' then (select a.email from public.applications a where a.id = p_id)
    when 'kontakt' then (select c.email from public.contact_messages c where c.id = p_id)
    when 'familj' then (select p.email from public.profiles p where p.id = p_id)
    when 'studiehjalpare' then (select p.email from public.profiles p where p.id = p_id)
  end), ''), 'gallrad')
$$;

-- Anmälningarna som avidentifieras: den valda och de med samma adress,
-- och för en familj också de som ledde till kontot.
create or replace function intern.radering_anmalningar(p_typ text, p_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.id
    from public.leads l
   cross join (select intern.radering_nyckel(p_typ, p_id) as k) n
   where l.email <> 'gallrad'
     and ((p_typ = 'anmalan' and (l.id = p_id or intern.epost_nyckel(l.email) = n.k))
       or (p_typ = 'familj' and (l.kund_id = p_id or intern.epost_nyckel(l.email) = n.k)))
$$;

-- Ansökningarna som tas bort: den valda och de med samma adress.
create or replace function intern.radering_ansokningar(p_typ text, p_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
    from public.applications a
   cross join (select intern.radering_nyckel(p_typ, p_id) as k) n
   where (p_typ = 'ansokan' and (a.id = p_id or intern.epost_nyckel(a.email) = n.k))
      or (p_typ = 'studiehjalpare' and intern.epost_nyckel(a.email) = n.k)
$$;

-- Kontaktmeddelandena som tas bort: det valda och de med samma adress.
create or replace function intern.radering_kontakter(p_typ text, p_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
    from public.contact_messages c
   cross join (select intern.radering_nyckel(p_typ, p_id) as k) n
   where (p_typ = 'kontakt' and c.id = p_id)
      or (p_typ <> 'elev' and intern.epost_nyckel(c.email) = n.k)
$$;

-- Filerna som ska vara borta ur lagringen innan raderna tas. Bara det
-- som finns: listan är exakt det adminvyn ska ta bort.
create or replace function intern.radering_filer(p_typ text, p_id uuid)
returns table (hink text, namn text)
language sql
stable
security definer
set search_path = public
as $$
  -- Profilbilden. Mappen är kontots id.
  select o.bucket_id::text, o.name::text
    from storage.objects o
   where o.bucket_id = 'avatarer'
     and p_typ in ('familj', 'studiehjalpare')
     and public.mapp_uuid(o.name) = p_id
  union all
  -- Elevens egen mapp i hinken material. Mappen är barnets id.
  select o.bucket_id::text, o.name::text
    from storage.objects o
   where o.bucket_id = 'material'
     and public.mapp_uuid(o.name) in (
           select s.id from public.students s
            where (p_typ = 'elev' and s.id = p_id)
               or (p_typ = 'familj' and s.parent_id = p_id))
  union all
  -- CV:n till ansökningarna som tas bort, utom en fil som en ansökan
  -- som står kvar också pekar ut.
  select o.bucket_id::text, o.name::text
    from storage.objects o
   where o.bucket_id = 'cv'
     and exists (select 1 from public.applications a
                  where a.id in (select intern.radering_ansokningar(p_typ, p_id))
                    and o.name = any (intern.ansokan_cv_namn(a.why)))
     and not exists (select 1 from public.applications b
                      where b.id not in (select intern.radering_ansokningar(p_typ, p_id))
                        and o.name = any (intern.ansokan_cv_namn(b.why)))
$$;

-- Ett hinder eller ett larm som ett jsonb-objekt, eller null när det
-- inte finns något att säga.
create or replace function intern.radering_rad(p_kod text, p_antal bigint, p_belopp bigint default null,
                                               p_minuter bigint default null)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case when coalesce(p_antal, 0) > 0 then
    jsonb_strip_nulls(jsonb_build_object('kod', p_kod, 'antal', p_antal,
                                         'belopp_ore', p_belopp, 'minuter', p_minuter))
  end
$$;


-- ------------------------------------------------------------
-- 5. Underlaget: vad en radering gör, och vad som hindrar den
--
-- Samma svar till rutan i adminvyn (radering_lage) som radera_person()
-- prövar mot, så att det rutan lovar är det som händer.
-- ------------------------------------------------------------
create or replace function intern.radering_underlag(p_typ text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  idag   date := (now() at time zone 'Europe/Stockholm')::date;
  p      public.profiles;
  s      public.students;
  hinder jsonb[] := '{}';
  larm   jsonb := '[]';
  tas    jsonb := '{}';
  kvar   jsonb := '{}';
  satt   text := 'helt';
  avbok  bigint := 0;
  barn   uuid[];
  pass   uuid[];
  nyckel text := intern.radering_nyckel(p_typ, p_id);
  n      bigint;
  m      bigint;
begin
  if p_typ is null or p_typ not in ('anmalan', 'ansokan', 'kontakt', 'familj', 'elev', 'studiehjalpare') then
    return jsonb_build_object('fel', 'Okänd sort: ' || coalesce(p_typ, 'ingen') || '.');
  end if;

  -- ---------- intresseanmälan ----------
  if p_typ = 'anmalan' then
    if not exists (select 1 from public.leads l where l.id = p_id and l.email <> 'gallrad') then
      return jsonb_build_object('fel', 'Anmälan finns inte, eller är redan avidentifierad.');
    end if;
    satt := 'avidentifieras';
    tas := jsonb_build_object(
      'anmalningar', (select count(*) from intern.radering_anmalningar(p_typ, p_id)),
      'kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)));
    kvar := jsonb_build_object('konto',
      exists (select 1 from public.leads l join public.profiles k on k.id = l.kund_id
               where l.id = p_id and k.raderad_at is null));

  -- ---------- ansökan ----------
  elsif p_typ = 'ansokan' then
    if not exists (select 1 from public.applications a where a.id = p_id) then
      return jsonb_build_object('fel', 'Ansökan finns inte längre.');
    end if;
    tas := jsonb_build_object(
      'ansokningar', (select count(*) from intern.radering_ansokningar(p_typ, p_id)),
      'kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)));
    kvar := jsonb_build_object('konto',
      exists (select 1 from public.profiles k
               where k.role = 'tutor' and k.raderad_at is null
                 and nyckel is not null and intern.epost_nyckel(k.email) = nyckel));

  -- ---------- kontaktmeddelande ----------
  elsif p_typ = 'kontakt' then
    if not exists (select 1 from public.contact_messages c where c.id = p_id) then
      return jsonb_build_object('fel', 'Meddelandet finns inte längre.');
    end if;
    tas := jsonb_build_object('kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)));

  -- ---------- familj ----------
  elsif p_typ = 'familj' then
    select * into p from public.profiles where id = p_id;
    if not found then
      return jsonb_build_object('fel', 'Kontot finns inte längre.');
    elsif p.is_admin then
      return jsonb_build_object('fel', 'Ett adminkonto raderas inte här.');
    elsif p.role <> 'parent' then
      return jsonb_build_object('fel', 'Kontot är inte en familj.');
    elsif p.raderad_at is not null then
      return jsonb_build_object('fel', 'Kontot är redan raderat.');
    end if;

    select coalesce(array_agg(x.id), '{}') into barn from public.students x where x.parent_id = p_id;
    select coalesce(array_agg(x.id), '{}') into pass from public.bookings x where x.parent_id = p_id;

    select count(*), coalesce(sum(greatest(coalesce(b.betalt_ore, 0) - coalesce(b.aterbetald_ore, 0), 0)), 0)
      into n, m from public.bookings b where b.parent_id = p_id and intern.passet_betalt_ej_hallet(b);
    hinder := hinder || intern.radering_rad('betalt_ej_hallet', n, m);

    select count(*), coalesce(sum(case when k.angerfrist_till >= idag then k.vid_anger_ore
                                       else k.vid_uppsagning_ore end), 0)
      into n, m
      from public.klippkort_saldo k
     where k.parent_id = p_id and k.status = 'betald' and k.giltigt_till >= idag
       and (case when k.angerfrist_till >= idag then k.vid_anger_ore else k.vid_uppsagning_ore end) > 0;
    hinder := hinder || intern.radering_rad('timmar_kvar', n, m);

    n := coalesce(intern.timbank_saldo(p_id), 0);
    if n > 0 then
      hinder := hinder || intern.radering_rad('timbank_kvar', 1, intern.timbank_varde(p_id, n::int)::bigint, n);
    end if;

    select count(*) into n from public.klippkort k
     where k.parent_id = p_id and k.status = 'vantar' and k.created_at > now() - interval '24 hours';
    hinder := hinder || intern.radering_rad('kassa_oppen', n);

    select count(*) into n from public.stripe_tvister t
     where t.booking_id = any (pass) and t.stangd is null;
    hinder := hinder || intern.radering_rad('tvist_oppen', n);

    select count(*), coalesce(sum(a.belopp_ore), 0)::bigint into n, m
      from public.avvikelser_rader() a where a.kund_id = p_id and a.typ = 'betalt_for_lange';
    hinder := hinder || intern.radering_rad('betalt_for_lange', n, m);

    select count(*) into n from public.bookings b
     where b.parent_id = p_id and b.status = 'confirmed' and intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('ej_rapporterat', n);

    select coalesce(jsonb_agg(x.rad order by x.typ), '[]') into larm
      from (select a.typ, intern.radering_rad(a.typ, count(*), sum(a.belopp_ore)::bigint) as rad
              from public.avvikelser_rader() a
             where a.kund_id = p_id and a.typ not in ('betalt_for_lange', 'betald_men_avbokad')
             group by a.typ) x;

    if exists (select 1 from public.klippkort k where k.parent_id = p_id)
       or exists (select 1 from public.invoices i where i.parent_id = p_id)
       or exists (select 1 from public.timbank_uttag u where u.parent_id = p_id)
       or exists (select 1 from public.lesson_reports r where r.student_id = any (barn))
       or exists (select 1 from public.bookings b where b.parent_id = p_id and intern.passet_bar_bokforing(b)) then
      satt := 'avidentifieras';
    end if;

    select count(*) into avbok from public.bookings b
     where b.parent_id = p_id and b.status in ('requested', 'confirmed')
       and not intern.passet_har_borjat(b) and not intern.passet_betalt_ej_hallet(b);

    tas := jsonb_build_object(
      'barn', (select count(*) from public.students x where x.parent_id = p_id and x.raderad_at is null),
      'meddelanden', (select count(*) from public.messages x where x.parent_id = p_id),
      'anmalningar', (select count(*) from intern.radering_anmalningar(p_typ, p_id)),
      'kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)),
      'anteckningar', (select count(*) from public.admin_noteringar x where x.om_profil = p_id));
    if satt = 'avidentifieras' then
      kvar := jsonb_build_object(
        'pass', (select count(*) from public.bookings b where b.parent_id = p_id and intern.passet_bar_bokforing(b)),
        'rapporter', (select count(*) from public.lesson_reports r where r.student_id = any (barn)),
        'klippkort', (select count(*) from public.klippkort k where k.parent_id = p_id),
        'fakturor', (select count(*) from public.invoices i where i.parent_id = p_id));
    end if;

  -- ---------- studiehjälpare ----------
  elsif p_typ = 'studiehjalpare' then
    select * into p from public.profiles where id = p_id;
    if not found then
      return jsonb_build_object('fel', 'Kontot finns inte längre.');
    elsif p.is_admin then
      return jsonb_build_object('fel', 'Ett adminkonto raderas inte här.');
    elsif p.role <> 'tutor' then
      return jsonb_build_object('fel', 'Kontot är inte en studiehjälpare.');
    elsif p.raderad_at is not null then
      return jsonb_build_object('fel', 'Kontot är redan raderat.');
    end if;

    select count(*) into n from public.students x
     where x.matched_tutor_id = p_id and x.match_status <> 'pending';
    hinder := hinder || intern.radering_rad('matchade_elever', n);

    select count(*) into n from public.bookings b
     where b.tutor_id = p_id and b.status = 'confirmed' and intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('ej_rapporterat', n);

    select count(*), coalesce(sum(b.betalt_ore - coalesce(b.aterbetald_ore, 0)), 0) into n, m
      from public.bookings b
     where b.tutor_id = p_id and b.status in ('requested', 'confirmed') and not intern.passet_har_borjat(b)
       and b.betalning_status in ('betald', 'tvist')
       and coalesce(b.betalt_ore, 0) > coalesce(b.aterbetald_ore, 0);
    hinder := hinder || intern.radering_rad('kommande_betalda', n, m);

    select coalesce(jsonb_agg(x.rad order by x.typ), '[]') into larm
      from (select a.typ, intern.radering_rad(a.typ, count(*), sum(a.belopp_ore)::bigint) as rad
              from public.avvikelser_rader() a
             where a.studiehjalpare_id = p_id
             group by a.typ) x;

    if exists (select 1 from public.lesson_reports r where r.tutor_id = p_id)
       or exists (select 1 from public.payouts u where u.tutor_id = p_id)
       or exists (select 1 from public.study_plans x where x.tutor_id = p_id)
       or exists (select 1 from public.homework x where x.tutor_id = p_id)
       or exists (select 1 from public.materials x where x.tutor_id = p_id)
       or exists (select 1 from public.progress_items x where x.tutor_id = p_id)
       or exists (select 1 from public.bookings b where b.tutor_id = p_id and intern.passet_bar_bokforing(b))
       -- profiles.matched_tutor_id har ingen ON DELETE. Står en familj
       -- kvar med hen, fast inget barn är matchat, hade borttagningen
       -- fallit på nyckeln.
       or exists (select 1 from public.profiles f where f.matched_tutor_id = p_id)
       -- Nycklarna till kontot sätts till null när det tas bort, och i en
       -- stängd månad nekar låset den ändringen.
       or exists (select 1 from public.bookings b
                   where (b.avbokad_av = p_id or b.created_by = p_id) and intern.manad_stangd(b.wanted_date)) then
      satt := 'avidentifieras';
    end if;

    select count(*) into avbok from public.bookings b
     where b.tutor_id = p_id and b.status in ('requested', 'confirmed') and not intern.passet_har_borjat(b);

    tas := jsonb_build_object(
      'meddelanden', (select count(*) from public.messages x where x.tutor_id = p_id),
      'ansokningar', (select count(*) from intern.radering_ansokningar(p_typ, p_id)),
      'kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)),
      'anteckningar', (select count(*) from public.admin_noteringar x where x.om_profil = p_id));
    kvar := jsonb_build_object(
      'handlingar', (select count(*) from public.handlingar h
                      where h.kopplad_tabell = 'profiles' and h.kopplad_id = p_id::text));
    if satt = 'avidentifieras' then
      kvar := kvar || jsonb_build_object(
        'pass', (select count(*) from public.bookings b where b.tutor_id = p_id and intern.passet_bar_bokforing(b)),
        'rapporter', (select count(*) from public.lesson_reports r where r.tutor_id = p_id),
        'underlag', (select count(*) from public.payouts u where u.tutor_id = p_id),
        'elevernas_material', (select count(*) from public.homework x where x.tutor_id = p_id)
                              + (select count(*) from public.study_plans x where x.tutor_id = p_id)
                              + (select count(*) from public.progress_items x where x.tutor_id = p_id)
                              + (select count(*) from public.materials x where x.tutor_id = p_id));
    end if;

  -- ---------- elev ----------
  else
    select * into s from public.students where id = p_id;
    if not found then
      return jsonb_build_object('fel', 'Eleven finns inte längre.');
    elsif s.raderad_at is not null then
      return jsonb_build_object('fel', 'Eleven är redan raderad.');
    end if;

    select coalesce(array_agg(x.id), '{}') into pass from public.bookings x where x.student_id = p_id;

    select count(*), coalesce(sum(greatest(coalesce(b.betalt_ore, 0) - coalesce(b.aterbetald_ore, 0), 0)), 0)
      into n, m from public.bookings b where b.student_id = p_id and intern.passet_betalt_ej_hallet(b);
    hinder := hinder || intern.radering_rad('betalt_ej_hallet', n, m);

    select count(*) into n from public.stripe_tvister t
     where t.booking_id = any (pass) and t.stangd is null;
    hinder := hinder || intern.radering_rad('tvist_oppen', n);

    select count(*) into n from public.bookings b
     where b.student_id = p_id and b.status = 'confirmed' and intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('ej_rapporterat', n);

    select coalesce(jsonb_agg(x.rad order by x.typ), '[]') into larm
      from (select a.typ, intern.radering_rad(a.typ, count(*), sum(a.belopp_ore)::bigint) as rad
              from public.avvikelser_rader() a
             where a.objekt_tabell = 'bookings' and a.objekt_id in (select unnest(pass)::text)
             group by a.typ) x;

    if exists (select 1 from public.lesson_reports r where r.student_id = p_id)
       or exists (select 1 from public.bookings b where b.student_id = p_id and intern.passet_bar_bokforing(b)) then
      satt := 'avidentifieras';
    end if;

    select count(*) into avbok from public.bookings b
     where b.student_id = p_id and b.status in ('requested', 'confirmed')
       and not intern.passet_har_borjat(b) and not intern.passet_betalt_ej_hallet(b);

    tas := jsonb_build_object(
      'laxor', (select count(*) from public.homework x where x.student_id = p_id),
      'material', (select count(*) from public.materials x where x.student_id = p_id),
      'omraden', (select count(*) from public.progress_items x where x.student_id = p_id),
      'studieplaner', (select count(*) from public.study_plans x where x.student_id = p_id));
    if satt = 'avidentifieras' then
      kvar := jsonb_build_object(
        'pass', (select count(*) from public.bookings b where b.student_id = p_id and intern.passet_bar_bokforing(b)),
        'rapporter', (select count(*) from public.lesson_reports r where r.student_id = p_id));
    end if;
  end if;

  return jsonb_build_object(
    'typ', p_typ,
    'satt', satt,
    'hinder', to_jsonb(array_remove(hinder, null)),
    'larm', coalesce(larm, '[]'),
    'avbokas', avbok,
    'tas_bort', tas,
    'star_kvar', kvar,
    'filer', (select coalesce(jsonb_agg(jsonb_build_object('hink', f.hink, 'namn', f.namn)
                                        order by f.hink, f.namn), '[]')
                from intern.radering_filer(p_typ, p_id) f));
end $$;


-- ------------------------------------------------------------
-- 6. Ett barn: bort helt, eller kvar utan uppgifter
--
-- Rapporterna står kvar när barnet avidentifieras: de gör passet
-- genomfört, och studiehjälparens lön räknas på dem (passunderlag).
-- Deras text töms. Tiden och skälet till en avvikelse står kvar, för
-- de förklarar beloppet och är låsta i en stängd månad; texten är det
-- inte (intern.las_stangd_manad).
-- ------------------------------------------------------------
create or replace function intern.elev_rensa(p_id uuid, p_helt boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  upd uuid;
begin
  delete from public.uppgifter where kopplad_tabell = 'students' and kopplad_id = p_id::text;
  delete from public.tutor_reviews where student_id = p_id;
  delete from public.notiser where elev_id = p_id;

  if p_helt then
    delete from public.students where id = p_id;
    return;
  end if;

  delete from public.homework where student_id = p_id;
  delete from public.materials where student_id = p_id;
  delete from public.progress_historik where student_id = p_id;
  delete from public.progress_items where student_id = p_id;
  delete from public.study_plans where student_id = p_id;
  delete from public.student_notes where student_id = p_id;

  update public.lesson_reports
     set raw_notes = '', ai_feedback = null, went_well = null, needs_practice = null, next_focus = null
   where student_id = p_id
     and (raw_notes <> '' or ai_feedback is not null or went_well is not null
          or needs_practice is not null or next_focus is not null);

  update public.students
     set name = 'Raderad elev', grade = null, school = null, goals = null, about = null,
         subjects = '{}', behov = '{}', format_onskemal = null,
         matched_tutor_id = null, match_status = 'pending', raderad_at = now()
   where id = p_id
  returning uppdrag_id into upd;

  -- Uppdragets beskrivning kan nämna barnet. Uppdraget står kvar, för
  -- passen pekar på det, men avslutat och utan text, om inget syskon
  -- delar det.
  if upd is not null and not exists (select 1 from public.students x
                                      where x.uppdrag_id = upd and x.id <> p_id and x.raderad_at is null) then
    update public.uppdrag set beskrivning = null, status = 'avslutat'
     where id = upd and (beskrivning is not null or status <> 'avslutat');
  end if;
end $$;


-- ------------------------------------------------------------
-- 7. Inloggningen
--
-- Helt: raden i auth.users tas bort, och kontot följer med.
-- Avidentifierat: raden står kvar för profiles.id, och stängs som
-- GoTrues mjuka radering gör. Token-kolumnerna blir tomma strängar,
-- inte null: GoTrue läser dem som text, och null i en av dem gör att
-- kontot inte ens går att visa i dashboarden.
-- ------------------------------------------------------------
create or replace function intern.inloggning_stang(p_id uuid, p_helt boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from auth.refresh_tokens where user_id = p_id::text;
  if p_helt then
    delete from auth.users where id = p_id;
    return;
  end if;
  delete from auth.sessions where user_id = p_id;
  delete from auth.identities where user_id = p_id;
  delete from auth.mfa_factors where user_id = p_id;
  delete from auth.one_time_tokens where user_id = p_id;
  update auth.users
     set email = null, phone = null, email_change = '', phone_change = '',
         encrypted_password = null,
         confirmation_token = '', recovery_token = '',
         email_change_token_current = '', email_change_token_new = '',
         phone_change_token = '', reauthentication_token = '',
         raw_user_meta_data = '{}'::jsonb,
         banned_until = now() + interval '100 years',
         deleted_at = now(), updated_at = now()
   where id = p_id;
end $$;


-- ------------------------------------------------------------
-- 8. Dörrarna
-- ------------------------------------------------------------

-- Vad en radering tar med sig, vad som står kvar och vad som hindrar
-- den. Läser, skriver ingenting.
create or replace function public.radering_lage(p_typ text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser vad en radering tar med sig.';
  end if;
  return intern.radering_underlag(p_typ, p_id);
end $$;

-- Raderar personen. Filerna ska redan vara borta ur lagringen.
create or replace function public.radera_person(p_typ text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  jag      uuid := auth.uid();
  lage     jsonb;
  satt     text;
  anm      uuid[];
  ans      uuid[];
  kon      uuid[];
  barn     uuid[];
  x        uuid;
  avbokade bigint := 0;
  gjort    text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum raderar personer.';
  end if;

  -- Två tryck på samma person väntar på varandra. Timbanken räknas
  -- under sitt eget lås (intern.timbank_rakna_overtid), och en rapport
  -- som skrivs samtidigt ska inte hinna dra ur den mitt i.
  perform pg_advisory_xact_lock(hashtextextended('radera:' || p_id::text, 0));
  if p_typ = 'familj' then
    perform pg_advisory_xact_lock(hashtextextended('timbank:' || p_id::text, 0));
  end if;
  if p_typ in ('familj', 'studiehjalpare') then
    perform 1 from public.profiles where id = p_id for update;
  end if;

  lage := intern.radering_underlag(p_typ, p_id);
  if lage ? 'fel' then
    raise exception using errcode = '22023', message = lage ->> 'fel';
  end if;
  if jsonb_array_length(lage -> 'hinder') > 0 then
    raise exception using errcode = '23514',
      message = 'Något måste göras först ('
        || (select string_agg(h ->> 'kod', ', ') from jsonb_array_elements(lage -> 'hinder') h)
        || '). Öppna Radera igen, så står det vad.';
  end if;
  if jsonb_array_length(lage -> 'filer') > 0 then
    raise exception using errcode = '23514',
      message = 'Filerna finns kvar i lagringen. De tas bort först, så att ingen fil blir kvar '
        || 'utan något som pekar ut den.';
  end if;
  satt := lage ->> 'satt';

  -- Mängderna räknas nu, medan adressen finns kvar att jämföra med.
  select coalesce(array_agg(i), '{}') into anm from intern.radering_anmalningar(p_typ, p_id) i;
  select coalesce(array_agg(i), '{}') into ans from intern.radering_ansokningar(p_typ, p_id) i;
  select coalesce(array_agg(i), '{}') into kon from intern.radering_kontakter(p_typ, p_id) i;

  -- ---------- det som gäller alla: anmälningar, ansökningar, kontakt ----------
  update public.leads
     set parent_name = 'Gallrad', email = 'gallrad', child_name = null, message = null, notering = null,
         -- Samma fält som nattjobbet (intern.leads_avidentifiera).
         landningssida = nullif(split_part(landningssida, '?', 1), ''),
         -- Står den kvar som ny eller kontaktad skapar uppföljningen en
         -- uppgift om den varje natt.
         status = case when status in ('new', 'contacted') then 'declined' else status end
   where id = any (anm);

  delete from public.uppgifter
   where (kopplad_tabell = 'leads' and kopplad_id in (select unnest(anm)::text))
      or (kopplad_tabell = 'applications' and kopplad_id in (select unnest(ans)::text))
      or (kopplad_tabell = 'contact_messages' and kopplad_id in (select unnest(kon)::text));

  -- applications_audit_borttagen skriver en rad per ansökan.
  delete from public.applications where id = any (ans);

  -- contact_messages har ingen trigger för borttagning; raden skrivs här.
  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, fore)
  select jag, 'admin', 'kontaktmeddelande.borttagen', 'contact_messages', c.id::text,
         jsonb_build_object('created_at', c.created_at, 'hanterad_at', c.hanterad_at)
    from public.contact_messages c where c.id = any (kon);
  delete from public.contact_messages where id = any (kon);

  -- ---------- familj ----------
  if p_typ = 'familj' then
    select coalesce(array_agg(s.id), '{}') into barn
      from public.students s where s.parent_id = p_id and s.raderad_at is null;

    -- Markeringen först: notis_vill() svarar nej från och med nu, så
    -- att avbokningarna nedan inte mejlar familjen.
    update public.profiles set raderad_at = now() where id = p_id;

    -- Gamla notiser om familjen bort, innan avbokningarna köar nya till
    -- studiehjälparen.
    delete from public.notiser where mottagare = p_id or trad_parent = p_id;
    delete from public.notis_utskick where mottagare = p_id or trad_parent = p_id;

    update public.bookings b
       set status = 'cancelled', avbokningsskal = 'familjen_avslutar'
     where b.parent_id = p_id and b.status in ('requested', 'confirmed')
       and not intern.passet_har_borjat(b) and not intern.passet_betalt_ej_hallet(b);
    get diagnostics avbokade = row_count;

    delete from public.notiser where mottagare = p_id;
    delete from public.notis_val where profil_id = p_id;
    delete from public.messages where parent_id = p_id;
    delete from public.admin_noteringar where om_profil = p_id;
    delete from public.uppgifter
     where (kopplad_tabell = 'profiles' and kopplad_id = p_id::text)
        or (kopplad_tabell = 'students'
            and kopplad_id in (select s.id::text from public.students s where s.parent_id = p_id));

    if satt = 'helt' then
      -- Passen går med kontot. Uppgifterna om dem också.
      delete from public.uppgifter
       where kopplad_tabell = 'bookings'
         and kopplad_id in (select b.id::text from public.bookings b where b.parent_id = p_id);
      perform intern.inloggning_stang(p_id, true);
    else
      foreach x in array barn loop
        perform intern.elev_rensa(x,
          not exists (select 1 from public.lesson_reports r where r.student_id = x)
          and not exists (select 1 from public.bookings b where b.student_id = x and intern.passet_bar_bokforing(b)));
      end loop;

      update public.bookings
         set location = null, note = null
       where parent_id = p_id and (location is not null or note is not null);
      delete from public.pass_forberedelse
       where booking_id in (select b.id from public.bookings b where b.parent_id = p_id);
      delete from public.pass_moten
       where booking_id in (select b.id from public.bookings b where b.parent_id = p_id);
      delete from public.tutor_reviews where parent_id = p_id;
      delete from public.faktura_sparr where parent_id = p_id;
      update public.uppdrag set beskrivning = null, status = 'avslutat'
       where kund_id = p_id and (beskrivning is not null or status <> 'avslutat');

      update public.profiles
         set full_name = 'Raderad familj', email = '', phone = null, bio = null, avatar_url = null
       where id = p_id;
      perform intern.inloggning_stang(p_id, false);
    end if;

    gjort := case when satt = 'helt' then 'raderat' else 'avidentifierat' end;
    insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
    values (jag, 'admin', 'konto.' || gjort, 'profiles', p_id::text,
            jsonb_build_object('roll', 'parent', 'avbokade_pass', avbokade, 'barn', cardinality(barn),
                               'anmalningar', cardinality(anm), 'kontaktmeddelanden', cardinality(kon)));

  -- ---------- studiehjälpare ----------
  elsif p_typ = 'studiehjalpare' then
    update public.profiles set raderad_at = now() where id = p_id;

    delete from public.notiser where mottagare = p_id or trad_tutor = p_id;
    delete from public.notis_utskick where mottagare = p_id or trad_tutor = p_id;

    -- Kommande pass avbokas, också de som betalats med timmar: timmarna
    -- går tillbaka till familjens kort (klippkortspass_avbokat). Pass
    -- betalda med kort är ett hinder ovan.
    update public.bookings b
       set status = 'cancelled', avbokningsskal = 'ingen_hjalpare'
     where b.tutor_id = p_id and b.status in ('requested', 'confirmed')
       and not intern.passet_har_borjat(b);
    get diagnostics avbokade = row_count;

    delete from public.notiser where mottagare = p_id;
    delete from public.notis_val where profil_id = p_id;
    delete from public.messages where tutor_id = p_id;
    delete from public.tutor_availability where tutor_id = p_id;
    delete from public.tutor_blocked where tutor_id = p_id;
    delete from public.tutor_reviews where tutor_id = p_id;
    delete from public.admin_noteringar where om_profil = p_id;
    delete from public.uppgifter where kopplad_tabell = 'profiles' and kopplad_id = p_id::text;

    if satt = 'helt' then
      perform intern.inloggning_stang(p_id, true);
    else
      -- Timpenningen och tjänsterna står kvar: underlaget för det som
      -- redan hållits räknas på dem.
      update public.tutor_profiles
         set status = 'rejected', visa_publikt = false, age = null, school = null, city = null,
             bio = null, availability = null, subjects = '{}', grade_levels = '{}', formats = '{}',
             stripe_account_id = null, stripe_krav = '{}'
       where id = p_id;
      update public.profiles
         set full_name = 'Raderad studiehjälpare', email = '', phone = null, bio = null, avatar_url = null
       where id = p_id;
      perform intern.inloggning_stang(p_id, false);
    end if;

    gjort := case when satt = 'helt' then 'raderat' else 'avidentifierat' end;
    insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
    values (jag, 'admin', 'konto.' || gjort, 'profiles', p_id::text,
            jsonb_build_object('roll', 'tutor', 'avbokade_pass', avbokade,
                               'ansokningar', cardinality(ans), 'kontaktmeddelanden', cardinality(kon)));

  -- ---------- elev ----------
  elsif p_typ = 'elev' then
    update public.bookings b
       set status = 'cancelled', avbokningsskal = 'familjen_avslutar'
     where b.student_id = p_id and b.status in ('requested', 'confirmed')
       and not intern.passet_har_borjat(b) and not intern.passet_betalt_ej_hallet(b);
    get diagnostics avbokade = row_count;

    perform intern.elev_rensa(p_id, satt = 'helt');

    gjort := case when satt = 'helt' then 'raderad' else 'avidentifierad' end;
    insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
    values (jag, 'admin', 'elev.' || gjort, 'students', p_id::text,
            jsonb_build_object('avbokade_pass', avbokade));

  -- ---------- anmälan ----------
  elsif p_typ = 'anmalan' then
    gjort := 'avidentifierad';
    insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
    values (jag, 'admin', 'anmalan.avidentifierad', 'leads', p_id::text,
            jsonb_build_object('anmalningar', cardinality(anm), 'kontaktmeddelanden', cardinality(kon)));

  -- ansökan och kontaktmeddelande: redan gjort ovan, och loggat.
  else
    gjort := 'borttagen';
  end if;

  return jsonb_build_object('ok', true, 'typ', p_typ, 'satt', satt, 'gjort', gjort,
                            'avbokade', avbokade, 'anmalningar', cardinality(anm),
                            'ansokningar', cardinality(ans), 'kontaktmeddelanden', cardinality(kon));
end $$;


-- ------------------------------------------------------------
-- 9. Rättigheterna
--
-- Hjälparna i intern når ingen utifrån. Dörrarna når inloggade, och
-- prövar is_admin() själva.
-- ------------------------------------------------------------
revoke execute on function intern.passet_har_borjat(public.bookings) from public, anon, authenticated;
revoke execute on function intern.passet_betalt_ej_hallet(public.bookings) from public, anon, authenticated;
revoke execute on function intern.passet_bar_bokforing(public.bookings) from public, anon, authenticated;
revoke execute on function intern.radering_nyckel(text, uuid) from public, anon, authenticated;
revoke execute on function intern.radering_anmalningar(text, uuid) from public, anon, authenticated;
revoke execute on function intern.radering_ansokningar(text, uuid) from public, anon, authenticated;
revoke execute on function intern.radering_kontakter(text, uuid) from public, anon, authenticated;
revoke execute on function intern.radering_filer(text, uuid) from public, anon, authenticated;
revoke execute on function intern.radering_rad(text, bigint, bigint, bigint) from public, anon, authenticated;
revoke execute on function intern.radering_underlag(text, uuid) from public, anon, authenticated;
revoke execute on function intern.elev_rensa(uuid, boolean) from public, anon, authenticated;
revoke execute on function intern.inloggning_stang(uuid, boolean) from public, anon, authenticated;

revoke execute on function public.radering_lage(text, uuid) from public, anon;
grant execute on function public.radering_lage(text, uuid) to authenticated;
revoke execute on function public.radera_person(text, uuid) from public, anon;
grant execute on function public.radera_person(text, uuid) to authenticated;

comment on function public.radering_lage(text, uuid) is
  'Vad radera_person() skulle göra med en person: sättet (helt eller avidentifieras), hindren, '
  'larmen, vad som avbokas, tas bort och står kvar, och filerna som ska bort ur lagringen först. '
  'Bara admin.';
comment on function public.radera_person(text, uuid) is
  'Raderar en intresseanmälan (avidentifieras), en ansökan, ett kontaktmeddelande, en familj, '
  'en elev eller en studiehjälpare. Bokföring står kvar utan något som pekar ut personen. Bara admin, '
  'och bara när filerna redan är borta ur lagringen.';
