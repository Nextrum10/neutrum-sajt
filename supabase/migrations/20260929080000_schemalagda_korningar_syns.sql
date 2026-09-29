-- ============================================================
-- NEXTRUM — de schemalagda körningarna syns i adminvyn
--
-- Rutan Schemalagda körningar under System → Automationer frågar
-- driftkorningar() och sa "Inget schema installerat" när funktionen
-- inte fanns. Fas 7 skrev den så med flit: funktionen skulle komma med
-- pg_cron, och att den fanns skulle vara svaret på om schemat fanns.
-- pg_cron kom med notiserna (Runda 2) utan den. Sedan dess har rutan
-- sagt att inget schema finns medan tretton jobb gått varje minut, var
-- femte minut och varje natt. Ett schema som går och ett som står av
-- såg återigen likadana ut, som flaggan notiser_mejl gjorde i månader
-- (CLAUDE.md avsnitt 5).
--
-- De fyra kontrollerna (dagliga_kontroller(), knappen kor_kontrollerna())
-- är fortfarande inte schemalagda, med flit. Den här migrationen visar
-- jobben som finns och schemalägger ingenting.
--
--
-- EN RAD PER JOBB, INTE EN PER KÖRNING
--
-- cron.job_run_details hade 11 800 körningar den senaste veckan
-- (2026-09-29), och 10 355 av dem var notis-minut. En lista över
-- körningarna hade PostgREST kapat vid tusen rader, alltså ett halvt
-- dygn av notis-minut, och nattens gallringar hade aldrig syns. Svaret
-- är därför varje jobb i cron.job, också ett som inte kört i fönstret:
-- den senaste körningen och dess utfall, hur många körningar och hur
-- många som misslyckades, och när det senaste felet kom och vad det sa.
--
--
-- VAD SOM INTE LÄMNAS UT
--
-- Kommandot aldrig. Rutan behöver det inte, och kommandot är första
-- stället en hemlighet hamnar den dag någon schemalägger ett anrop
-- direkt. I dag bär inget av de tretton något: de anropar en funktion,
-- och hemligheten i notis_konfig går i anropets headers genom
-- intern.natanrop.
--
-- Svaret (return_message) bara för en körning som inte gick igenom. En
-- lyckad säger "1 row" eller "DELETE 3", och det är inget att visa. Av
-- ett fel bara första raden: libpq skriver DETAIL och CONTEXT på raderna
-- efter, och DETAIL bär radens värden ("Failing row contains …", "Key
-- (email)=(…) already exists"). Första raden kan också bära ett värde
-- ("invalid input syntax for type uuid: …"), så där byts notis_konfigs
-- två hemligheter ut, liksom varje följd av minst tjugo bokstäver och
-- siffror utan mellanrum (nycklar, uuid:n, JWT:er, adresser), och e-post
-- och nummer genom maska_kontakt(). Högst 200 tecken. En funktion som
-- lämnar ut ett fel vet inte vad nästa fel innehåller, så den lämnar
-- hellre ut för lite.
--
-- pg_cron sparar körningarna i sju dagar (jobbet cron-stada). Ett
-- längre fönster ger samma svar som sju dagar.
-- ============================================================

-- ---------- 1. ett fel som går att visa ----------
create or replace function intern.driftsvar(p text, p_dolj text[] default '{}')
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  t text := split_part(coalesce(p, ''), E'\n', 1);
  h text;
begin
  -- libpq skriver "ERROR:  meddelandet". Rutan säger redan att det gick fel.
  t := regexp_replace(t, '^\s*(ERROR|FATAL|PANIC):\s*', '');

  -- En kort "hemlighet" hade bytt ut vanliga ord i meddelandet.
  foreach h in array coalesce(p_dolj, '{}'::text[]) loop
    if length(h) >= 16 then
      t := replace(t, h, '[hemlighet]');
    end if;
  end loop;

  -- Minst tjugo tecken utan mellanrum, med både siffror och bokstäver:
  -- en nyckel, ett uuid, en JWT, en adress. Ett funktionsnamn som
  -- intern.obesvarade_forslag_slapper_timmarna har inga siffror och står kvar.
  t := regexp_replace(t,
    '(?=[A-Za-z0-9+/=._-]*[0-9])(?=[A-Za-z0-9+/=._-]*[A-Za-z])[A-Za-z0-9+/=._-]{20,}',
    '[dolt]', 'g');

  t := public.maska_kontakt(t);
  return nullif(left(btrim(t), 200), '');
end $$;

comment on function intern.driftsvar(text, text[]) is
  'Det av ett pg_cron-svar som går att visa: första raden, utan felnivån, med hemligheterna i p_dolj, nycklar, '
  'uuid:n, e-post och nummer utbytta, högst 200 tecken. driftkorningar() använder den.';

-- Bara postgres. anon och authenticated har USAGE på intern, så EXECUTE
-- måste tas bort uttryckligen.
revoke execute on function intern.driftsvar(text, text[]) from public, anon, authenticated;

-- ---------- 2. jobben och deras körningar, för adminvyn ----------
create or replace function public.driftkorningar(dagar integer default 7)
returns table (jobb text, schema text, aktivt boolean, startade timestamptz, status text, svar text,
               korningar integer, misslyckade integer, senast_misslyckad timestamptz, fel text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  fran timestamptz;
  dolj text[];
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser de schemalagda körningarna.';
  end if;

  fran := now() - make_interval(days => greatest(1, least(coalesce(dagar, 7), 31)));
  select array[k.hemlighet, k.avregistreringsnyckel] into dolj from public.notis_konfig k where k.id = 1;

  -- Kolumnerna står med tabellnamn överallt: returkolumnerna heter som
  -- cron-tabellernas (status), och i plpgsql är de variabler.
  return query
  with korda as (
    select d.jobid, d.runid, d.status, d.return_message, d.start_time
      from cron.job_run_details d
     where d.start_time >= fran
  ),
  antal as (
    select k.jobid, count(*)::integer as alla,
           (count(*) filter (where k.status = 'failed'))::integer as misslyckade
      from korda k
     group by k.jobid
  ),
  senaste as (
    select distinct on (k.jobid) k.jobid, k.status, k.return_message, k.start_time
      from korda k
     order by k.jobid, k.start_time desc, k.runid desc
  ),
  senaste_fel as (
    select distinct on (k.jobid) k.jobid, k.return_message, k.start_time
      from korda k
     where k.status = 'failed'
     order by k.jobid, k.start_time desc, k.runid desc
  )
  select coalesce(j.jobname, 'jobb ' || j.jobid),
         j.schedule,
         j.active,
         s.start_time,
         s.status,
         case when s.status is distinct from 'succeeded' then intern.driftsvar(s.return_message, dolj) end,
         coalesce(a.alla, 0),
         coalesce(a.misslyckade, 0),
         f.start_time,
         intern.driftsvar(f.return_message, dolj)
    from cron.job j
    left join antal a on a.jobid = j.jobid
    left join senaste s on s.jobid = j.jobid
    left join senaste_fel f on f.jobid = j.jobid
   order by j.jobname;
end $$;

comment on function public.driftkorningar(integer) is
  'Varje pg_cron-jobb med sin senaste körning och dess utfall, antalet körningar och misslyckade de senaste '
  'dagarna (1–31; pg_cron sparar sju) och det senaste felet. Bara för admin. Kommandot lämnas aldrig ut, och '
  'svaret bara för en körning som inte gick igenom (intern.driftsvar). Adminvyn visar det under System → Automationer.';

revoke execute on function public.driftkorningar(integer) from public, anon;
grant execute on function public.driftkorningar(integer) to authenticated;
