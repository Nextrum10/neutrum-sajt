-- ============================================================
-- NEXTRUM — anmälningarna raderas helt (2026-10-29)
--
-- Leo: "de avidentifierade anmälningarna och ansökningarna ska bort helt
-- och hållet ur systemet och ej sparas någonstans".
--
-- Ansökningarna avidentifierades aldrig: nattjobbet, papperskorgen och
-- radera_person tar redan bort dem med CV:t. Det som stod kvar var
-- anmälningarna: en avidentifierad anmälan var en rad i leads med
-- email = 'gallrad' och datum, årskurs, ämne, källa och kod kvar för
-- statistiken, och intagna_anmalningar stod kvar med parent_id null när
-- familjen togs bort. Nu raderas raden i stället, på alla fyra ställen:
--   1. Nattjobbet (intern.leads_avidentifiera, namnet står kvar för att
--      pg_cron ringer det): anmälan raderas sex månader efter senaste
--      kontakten, med sina uppgifter. En rad i intagna_anmalningar utan
--      familj, eller vars familj är raderad eller avidentifierad, raderas.
--   2. Papperskorgen (intern.anmalan_i_papperskorgen): raderar raden.
--   3. radera_person: anmälningarna med samma adress raderas, och en
--      familjs rader i intagna_anmalningar raderas med familjen.
--   4. Det som redan står kvar: de avidentifierade anmälningarna och de
--      intagna utan familj raderas nu.
--
-- Följden: statistiken räknar bara anmälningar som finns, alltså de
-- senaste sex månaderna och familjernas egna (intagna_anmalningar).
-- Ingen främmande nyckel pekar på leads, och auditloggen bär bara
-- vitlistade kolumner, aldrig namn.
--
-- Funktionerna lappas med replace() och räknade träffar, eller skrivs om
-- med en vakt på driftens md5 (lästa 2026-10-29). Inget drop. Filen har
-- delete i funktioner och utanför, så den körs avsnitt för avsnitt med
-- execute_sql och registreras sedan (CLAUDE.md avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f record;
begin
  for f in
    select * from (values
      ('intern.leads_avidentifiera()',                    '659bf578f5d4b1154a35449d740cf413'),
      ('intern.anmalan_i_papperskorgen(uuid)',            '561eb198d990984b216621899ac866e8'),
      ('public.ta_bort_ur_stallet(text, uuid, boolean)',  '04741f1492ef36211cbf9db11664e73e'),
      ('public.radera_person(text, uuid)',                '894d09dc21dec1b35654982469e55be2')) v(namn, summa)
  loop
    if md5(pg_get_functiondef(f.namn::regprocedure)) <> f.summa then
      raise exception '% är inte den som lästes 2026-10-29: läs driften först.', f.namn;
    end if;
  end loop;
end $$;


-- ---------- 1. nattjobbet ----------
create or replace function intern.leads_avidentifiera()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n        integer;
  m        integer;
  r        integer;
  fastnade integer;
begin
  -- anmalningar_raderas_helt (2026-10-29): anmälan raderas, med det som
  -- pekar på den i Att göra. En gammal avidentifierad rad ('gallrad') tas
  -- med, om någon skulle stå kvar.
  delete from public.uppgifter u
   using public.leads l
   where u.kopplad_tabell = 'leads' and u.kopplad_id = l.id::text
     and (l.email = 'gallrad' or intern.leads_avidentifieras_fran(l) <= now());

  delete from public.leads l
   where l.email = 'gallrad' or intern.leads_avidentifieras_fran(l) <= now();
  get diagnostics n = row_count;

  -- En anmälan som flyttats till familjen gallras på samma dag som den
  -- hade raderats i leads: meddelandet går, raden står kvar med familjen.
  update public.intagna_anmalningar i
     set meddelande    = null,
         landningssida = nullif(split_part(i.landningssida, '?', 1), '')
   where (i.meddelande is not null or i.landningssida like '%?%')
     and greatest(i.anmald_at, coalesce(i.kontaktad_at, i.anmald_at)) + interval '6 months' <= now();
  get diagnostics m = row_count;

  -- Utan familj är den en avidentifierad anmälan, och den sparas inte.
  delete from public.intagna_anmalningar i
   where i.parent_id is null
      or exists (select 1 from public.profiles p where p.id = i.parent_id and p.raderad_at is not null);
  get diagnostics r = row_count;

  select count(*) into fastnade
    from public.leads l
   where intern.leads_avidentifieras_fran(l) <= now() - interval '7 days';

  if fastnade > 0 then
    perform public.skapa_uppgift(
      'Raderingen av intresseanmälningar har fastnat',
      'gallring:leads:fastnat',
      'problem',
      fastnade || ' intresseanmälningar skulle ha raderats för mer än en vecka sedan. '
        || 'Jobbet heter leads-avidentifiering i pg_cron; dess utfall står i cron.job_run_details. '
        || 'DATASKYDD.md, Gallring.',
      null, null, (now() at time zone 'Europe/Stockholm')::date, 'system');
  end if;

  return jsonb_build_object('raderade', n, 'intagna', m, 'intagna_raderade', r, 'fastnade', fastnade);
end $$;

comment on function intern.leads_avidentifiera() is
  'Nattjobbet leads-avidentifiering (namnet från 2026-09-27). Sedan 2026-10-29 (anmalningar_raderas_helt) raderar '
  'det anmälan sex månader efter senaste kontakten, gallrar meddelandet i intagna_anmalningar på samma dag och '
  'raderar en intagen anmälan utan familj. Inget avidentifieras och står kvar.';


-- ---------- 2. papperskorgen ----------
create or replace function intern.anmalan_i_papperskorgen(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  -- anmalningar_raderas_helt (2026-10-29): raden raderas, inget står kvar.
  delete from public.leads where id = p_id;
$$;

revoke all on function intern.anmalan_i_papperskorgen(uuid) from public, anon, authenticated;

do $$
declare
  def     text := pg_get_functiondef('public.ta_bort_ur_stallet(text, uuid, boolean)'::regprocedure);
  gammalt text := E'''anmalan.avidentifierad''';
  traffar integer;
begin
  traffar := (length(def) - length(replace(def, gammalt, ''))) / length(gammalt);
  if traffar <> 1 then
    raise exception 'ta_bort_ur_stallet: anmalan.avidentifierad hittades % gånger, väntat en.', traffar;
  end if;
  execute replace(def, gammalt, E'''anmalan.raderad''');
end $$;

comment on function public.ta_bort_ur_stallet(text, uuid, boolean) is
  'Papperskorgen (2026-10-26): tar bort en anmälan eller en ansökan ur sin lista, och inget annat; båda raderas '
  '(anmälan sedan 2026-10-29, anmalningar_raderas_helt). Är raden det sista stället personen finns krävs p_helt. '
  'Bara superadmin. Radera hela personen: radera_person().';


-- ---------- 3. radera_person ----------
do $$
declare
  def   text := pg_get_functiondef('public.radera_person(text, uuid)'::regprocedure);
  byten text[][] := array[
    array[
      E'  update public.leads\n'
      || E'     set parent_name = ''Gallrad'', email = ''gallrad'', child_name = null, message = null, notering = null,\n'
      || E'         -- Samma fält som nattjobbet (intern.leads_avidentifiera).\n'
      || E'         landningssida = nullif(split_part(landningssida, ''?'', 1), ''''),\n'
      || E'         -- Står den kvar som ny eller kontaktad skapar uppföljningen en\n'
      || E'         -- uppgift om den varje natt.\n'
      || E'         status = case when status in (''new'', ''contacted'') then ''declined'' else status end\n'
      || E'   where id = any (anm);',
      E'  -- anmalningar_raderas_helt (2026-10-29): anmälningarna raderas, inget\n'
      || E'  -- står kvar för statistiken.\n'
      || E'  delete from public.leads where id = any (anm);'],
    array[
      E'  update public.intagna_anmalningar\n'
      || E'     set meddelande = null, landningssida = nullif(split_part(landningssida, ''?'', 1), '''')\n'
      || E'   where p_typ = ''familj'' and parent_id = p_id;',
      E'  delete from public.intagna_anmalningar\n'
      || E'   where p_typ = ''familj'' and parent_id = p_id;'],
    array[
      E'  elsif p_typ = ''anmalan'' then\n    gjort := ''avidentifierad'';',
      E'  elsif p_typ = ''anmalan'' then\n    gjort := ''raderad'';'],
    array[
      E'''anmalan.avidentifierad''',
      E'''anmalan.raderad''']];
  i       integer;
  traffar integer;
begin
  for i in 1 .. array_length(byten, 1) loop
    traffar := (length(def) - length(replace(def, byten[i][1], ''))) / length(byten[i][1]);
    if traffar <> 1 then
      raise exception 'radera_person: byte % hittades % gånger, väntat en. Läs driften.', i, traffar;
    end if;
    def := replace(def, byten[i][1], byten[i][2]);
  end loop;
  execute def;
end $$;


-- ---------- 4. det som redan står kvar ----------
delete from public.uppgifter u
 using public.leads l
 where u.kopplad_tabell = 'leads' and u.kopplad_id = l.id::text and l.email = 'gallrad';

delete from public.leads where email = 'gallrad';

delete from public.intagna_anmalningar i
 where i.parent_id is null
    or exists (select 1 from public.profiles p where p.id = i.parent_id and p.raderad_at is not null);

comment on column public.intagna_anmalningar.parent_id is
  'Familjen. Raderas eller avidentifieras familjen raderas raden (radera_person, och nattjobbet om någon blev kvar '
  'utan familj): en anmälan sparas inte utan sin familj (2026-10-29).';
