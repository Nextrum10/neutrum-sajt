-- ============================================================
-- NEXTRUM — Fas 13.4: notisernas läge går att läsa ur adminvyn
--
-- Runda 2 byggde hela notisvägen: triggrar, kö, pg_cron, arbetare,
-- mallar och avanmälan. Det som aldrig byggdes var REGLAGET. Flaggan
-- notiser_mejl stod av, sandlådan var tom, och notis_utskick_ta
-- märkte därför varje mejlrad som loggad — raden syns i vyn, mejlet
-- går aldrig. Ingen fil i repot nämnde tabellen flaggor, så det gick
-- inte att se i produkten att systemet var avstängt, bara att det
-- var tyst. Ett system som är avstängt och ett system som är trasigt
-- ser likadana ut inifrån.
--
-- Den här migrationen lägger till EN funktion: läsningen som
-- adminvyns notisflik behöver. Skrivningarna fanns redan — policyer
-- och kolumnrättigheter för flaggor och notis_drift sattes i
-- r2_fas1_1 och r2_fas2_1, och notis_provmejl och notis_kor_nu är
-- redan nåbara för authenticated. Det saknades bara någon som
-- anropade dem.
--
-- RÄKNINGEN SKER I DATABASEN, INTE I WEBBLÄSAREN. Fas 9.8 kostade
-- den lärdomen en gång: auditfliken hämtade 300 rader och
-- filtrerade dem på klienten, vilket fungerar medan loggen är tom
-- och slutar fungera tyst vid rad 301. Kön växer med varje pass och
-- varje meddelande, så samma fel hade kommit tillbaka här.
--
-- INGEN BRÖDTEXT LÄMNAR FUNKTIONEN. Svaret bär status, kanal och
-- antal — aldrig data, mottagare, adress eller radens felkropp, som
-- kan upprepa en adress. Den som behöver se en enskild rad läser
-- notis_utskick direkt under sin egen adminpolicy.
-- ============================================================

create or replace function public.notis_lage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  klocka jsonb := null;
  svar   jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser notisernas läge.';
  end if;

  -- pg_cron ligger i ett eget schema som inte behöver finnas. EXECUTE
  -- i stället för en rak select: en saknad tabell ska ge "ingen
  -- klocka" i svaret, inte ett fel som tar hela fliken med sig.
  if to_regclass('cron.job') is not null then
    begin
      execute $q$
        select jsonb_build_object('namn', j.jobname, 'schema', j.schedule, 'aktiv', j.active,
                                  'senast', (select max(r.start_time) from cron.job_run_details r
                                              where r.jobid = j.jobid))
          from cron.job j where j.jobname = 'notis-minut'
      $q$ into klocka;
    exception when others then
      klocka := null;
    end;
  end if;

  select jsonb_build_object(
    'ko', coalesce((
      select jsonb_agg(jsonb_build_object('status', k.status, 'kanal', k.kanal, 'antal', k.antal)
                       order by k.status, k.kanal)
        from (select u.status, u.kanal, count(*) as antal
                from public.notis_utskick u group by 1, 2) k), '[]'::jsonb),
    'vantar_nu', (select count(*) from public.notis_utskick u
                   where u.status = 'vantar' and u.skicka_efter <= now()),
    'senast_skickat', (select max(u.uppdaterad) from public.notis_utskick u where u.status = 'skickad'),
    'korningar', coalesce((
      select jsonb_agg(jsonb_build_object('tid', r.tid, 'behandlade', r.behandlade,
                                          'skickade', r.skickade, 'misslyckade', r.misslyckade,
                                          'meddelande', r.meddelande) order by r.tid desc)
        from (select * from public.notis_korningar order by tid desc limit 10) r), '[]'::jsonb),
    'klocka', klocka
  ) into svar;

  return svar;
end $$;

comment on function public.notis_lage() is
  'Notisköns läge för adminvyn: antal per status och kanal, hur många som väntar just nu, '
  'de tio senaste körningarna och om pg_cron-jobbet notis-minut lever. Räknar i databasen, '
  'lämnar aldrig ut brödtext, adresser eller mottagare. Admin-only.';

revoke execute on function public.notis_lage() from public, anon;
grant execute on function public.notis_lage() to authenticated;
