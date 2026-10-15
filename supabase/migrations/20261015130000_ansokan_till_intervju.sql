-- ============================================================
-- Ansökan skickas vidare till intervju (2026-10-15)
--
-- Leo: "de fyra stadierna när en ansökan om jobb kommer in är ny,
-- kontaktad, godkänd eller avböjd. detta innebär att jag klickar själv i
-- de vid klick av profil ... där det passar ska det också finnas skicka
-- vidare till intervju, det är då för nya ansökningar. så i intervjudelen
-- ska namn bara finnas där som jag har klickat i att de ska vidare till
-- intervju. sen när de ligger i intervju så finns det att skicka vidare
-- till utbildnings sektionen."
--
-- Fliken Intervju i adminvyn räknade sedan 2026-10-13 läget Kontaktad som
-- intervju, och knappen Till intervju satte det läget. Men läget är Leos
-- egen markering av vem han hört av sig till: i driften stod sju av nio
-- ansökningar under Intervju för att de var Kontaktad, utan att någon
-- valt att de skulle dit. Steget får därför en egen tidsstämpel, och
-- läget ändras bara när Leo trycker på det.
--
-- 1. applications.till_intervju_at: när ansökan skickades vidare till
--    intervju (Skicka vidare till intervju, eller ett bokat möte). Ingen
--    bakåtfyllning: ingen vet vilka av de sju som skulle dit, så fliken
--    börjar tom och Leo skickar dit dem han vill intervjua.
-- 2. skydda_ansokningsfalt: steget sätts aldrig av den som söker, som de
--    andra stegen.
-- 3. Gallringen räknar steget (ett nytt rekryteringssteg med tidsstämpel
--    ska in i intern.ansokan_gallras_fran, CLAUDE.md avsnitt 5), så en
--    ansökan står kvar trettio dagar efter att den skickats vidare, som
--    integritetspolicyn säger om det senaste steget i rekryteringen.
-- 4. Auditloggen tar tidpunkten, när den ändras och när ansökan tas bort.
--
-- Inget mejlas: ansokan_besked lyssnar inte på kolumnen. Funktionerna och
-- triggrarna prövas först mot driften som den lästes 2026-10-15 (md5 på
-- pg_get_functiondef och pg_get_triggerdef); en som redan bär
-- till_intervju_at släpps igenom, så filen går att köra två gånger. Filen
-- tar inte bort något, varken objekt eller rader, så den kan köras hel i
-- ett do-block utan verktygets bekräftelse (CLAUDE.md avsnitt 5).
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
      ('public.skydda_ansokningsfalt()',                    '69543b74e33af75b29b64363968f3dc7'),
      ('intern.ansokan_gallras_fran(public.applications)', '3ac8db2714f6effbfe60a196274d629b')) v(namn, summa)
  loop
    def := pg_get_functiondef(f.namn::regprocedure);
    if position('till_intervju_at' in def) = 0 and md5(def) <> f.summa then
      raise exception '% har ändrats sedan ansokan_till_intervju skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(def);
    end if;
  end loop;

  for f in
    select * from (values
      ('applications_audit',           '68cfe817f468e5f777e377430679996f'),
      ('applications_audit_borttagen', '815780d3f5ee5cd2e2e50edac4496d2e')) v(namn, summa)
  loop
    select pg_get_triggerdef(t.oid) into def
      from pg_trigger t
     where t.tgrelid = 'public.applications'::regclass and t.tgname = f.namn;
    if def is null then
      raise exception 'Triggern % saknas på applications. Läs driften.', f.namn;
    end if;
    if position('till_intervju_at' in def) = 0 and md5(def) <> f.summa then
      raise exception 'Triggern % har ändrats sedan ansokan_till_intervju skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(def);
    end if;
  end loop;
end $$;


-- ---------- 1. kolumnen ----------
alter table public.applications
  add column if not exists till_intervju_at timestamptz;

comment on column public.applications.till_intervju_at is
  'När admin skickade ansökan vidare till intervju (Skicka vidare till intervju, eller ett bokat möte). '
  'Fliken Intervju läser den, aldrig läget: läget (Ny, Kontaktad) sätter admin själv. Sätts aldrig utifrån '
  '(skydda_ansokningsfalt).';


-- ---------- 2. den som söker sätter inte steget ----------
create or replace function public.skydda_ansokningsfalt()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
-- ansokan_till_intervju (2026-10-15): steget till intervju.
-- ansokan_vardnadshavare_och_nej (2026-10-05): vårdnadshavarens adress och godkännande.
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
  giltiga text[];
begin
  if public.is_admin()
     or jwtroll = 'service_role'
     or (jwtroll is null and session_user in ('postgres', 'supabase_admin'))
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Läget och tidsstämplarna sätts av Nextrum, aldrig av den som söker.
    new.status       := 'new';
    new.kontaktad_at := null;
    new.intervju_at  := null;
    new.utbildad_at  := null;
    new.notering     := null;
    -- Fas 16.1: mötet också. Ett mötesmejl byggs på de här två fälten,
    -- och en länk som den som söker själv skrivit in är en nätfiskelänk
    -- i ett mejl från vår domän.
    new.mote_tid     := null;
    new.mote_lank    := null;
    -- Fas 16.1c: och när ansökan kom in. Kvittobromsen räknar på den,
    -- och en tid den som postar själv väljer är ingen broms.
    new.created_at   := now();
    -- Fas 22.1: och provet. Påminnelsejobbet mejlar alla med en satt
    -- sista dag, och en egen nyckel hade varit ett prov man själv
    -- bestämt facit till.
    new.utbildningsmote_at := null;
    new.prov_sista_dag     := null;
    new.prov_nyckel        := null;
    new.prov_godkant_at    := null;
    -- 2026-10-05: och vårdnadshavarens godkännande. Det läggs in av admin
    -- när svaret kommit, aldrig av den som söker.
    new.vardnadshavare_godkand_at := null;
    new.vardnadshavare_svar       := null;
    -- 2026-10-15: och steget till intervju. Fliken Intervju läser det,
    -- och bara admin väljer vem som går vidare.
    new.till_intervju_at := null;

    -- Bara tjänster som faktiskt går att söka till. En kod som inte
    -- gör det skrivs om i stället för att neka ansökan — vi ska inte
    -- straffa någon för att vår katalog ändrats under tiden.
    select array_agg(k) into giltiga
      from unnest(coalesce(new.tjanster, '{}'::text[])) as k
     where exists (select 1 from public.tjanster t
                    where t.kod = k and t.aktiv and t.for_jobb);

    if giltiga is null or cardinality(giltiga) = 0 then
      select array[t.kod] into giltiga
        from public.tjanster t
       where t.aktiv and t.for_jobb
       order by t.ordning, t.kod
       limit 1;
    end if;
    new.tjanster := coalesce(giltiga, array['laxhjalp']);

    -- Längdtaken. Samma skäl som för leads: utan dem kan vem som
    -- helst posta en rad på flera megabyte mot det öppna API:et, och
    -- den raden läses sedan av adminvyn och av notismejlet.
    new.name         := left(new.name, 120);
    new.email        := left(new.email, 200);
    new.school       := left(new.school, 120);
    new.subjects     := left(new.subjects, 200);
    new.availability := left(new.availability, 200);
    new.why          := left(new.why, 4000);
    -- 2026-10-05: vårdnadshavarens adress sparas bara för den som är under
    -- 18. Den mejlas av ansokan_besked, och för den som är vuxen finns inget
    -- skäl att ha den, eller att mejla den.
    new.vardnadshavare_epost := case
      when new.age between 1 and 17 then nullif(left(btrim(new.vardnadshavare_epost), 200), '')
      else null
    end;
  else
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.intervju_at  := old.intervju_at;
    new.utbildad_at  := old.utbildad_at;
    new.notering     := old.notering;
    new.tjanster     := old.tjanster;
    new.mote_tid     := old.mote_tid;
    new.mote_lank    := old.mote_lank;
    new.created_at   := old.created_at;
    new.utbildningsmote_at := old.utbildningsmote_at;
    new.prov_sista_dag     := old.prov_sista_dag;
    new.prov_nyckel        := old.prov_nyckel;
    new.prov_godkant_at    := old.prov_godkant_at;
    new.vardnadshavare_epost      := old.vardnadshavare_epost;
    new.vardnadshavare_godkand_at := old.vardnadshavare_godkand_at;
    new.vardnadshavare_svar       := old.vardnadshavare_svar;
    new.till_intervju_at          := old.till_intervju_at;
  end if;
  return new;
end $function$;


-- ---------- 3. gallringen räknar steget ----------
create or replace function intern.ansokan_gallras_fran(a public.applications)
 returns timestamp with time zone
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  -- ansokan_till_intervju (2026-10-15): till_intervju_at är ett steg.
  -- ansokan_vardnadshavare_och_nej (2026-10-05): vardnadshavare_godkand_at är ett steg.
  with steg as (
    select greatest(a.kontaktad_at, a.till_intervju_at, a.mote_tid, a.intervju_at, a.utbildningsmote_at,
                    (a.prov_sista_dag + 1)::timestamp at time zone 'Europe/Stockholm',
                    a.prov_godkant_at, a.utbildad_at, a.vardnadshavare_godkand_at) as senast
  ),
  hjalpare as (
    -- Senaste gången studiehjälparen med samma adress var aktiv: kontot,
    -- inloggningen, ett pass som inte avbokats eller en rapport. Bara en
    -- godkänd studiehjälpare räknas, som i skyddsnätet förut.
    select max(greatest(
             t.created_at, p.created_at, p.last_seen_at, u.last_sign_in_at,
             (select max(b.wanted_date)::timestamp at time zone 'Europe/Stockholm'
                from public.bookings b
               where b.tutor_id = t.id and b.status <> 'cancelled'),
             (select max(r.created_at) from public.lesson_reports r where r.tutor_id = t.id)
           )) as senast
      from public.profiles p
      join public.tutor_profiles t on t.id = p.id
      left join auth.users u on u.id = p.id
     where a.status <> 'rejected'
       and t.status = 'approved'
       and intern.epost_nyckel(a.email) <> ''
       and intern.epost_nyckel(p.email) = intern.epost_nyckel(a.email)
  )
  select case
    when h.senast is not null then h.senast + interval '2 years'
    when a.status = 'approved' then greatest(a.created_at, s.senast) + interval '2 years'
    else greatest(a.created_at + interval '1 year', s.senast + interval '30 days')
  end
  from steg s, hjalpare h
$function$;


-- ---------- 4. auditloggen tar tidpunkten ----------
-- Bara tidpunkten, som för de andra stegen: auditloggen tar inga namn och
-- ingen fritext.
create or replace trigger applications_audit
  after update of status, kontaktad_at, till_intervju_at, intervju_at, utbildad_at, utbildningsmote_at,
                  prov_sista_dag, prov_godkant_at, vardnadshavare_godkand_at
  on public.applications
  for each row execute function public.logga_andring('ansokan', 'id', 'status', 'kontaktad_at', 'till_intervju_at',
    'intervju_at', 'utbildad_at', 'utbildningsmote_at', 'prov_sista_dag', 'prov_godkant_at', 'vardnadshavare_godkand_at');

create or replace trigger applications_audit_borttagen
  after delete on public.applications
  for each row execute function public.logga_andring('ansokan', 'id', 'status', 'created_at', 'kontaktad_at',
    'till_intervju_at', 'mote_tid', 'intervju_at', 'utbildningsmote_at', 'prov_sista_dag', 'prov_godkant_at',
    'utbildad_at');
