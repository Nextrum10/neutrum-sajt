-- Fas 5.1 — tjänstekatalogen bär det en tjänst behöver.
--
-- Hittills visste tjanster bara namn, pris och flerbarnstillägg; allt
-- annat var inbyggt antagande om läxhjälp. De nya kolumnerna beskriver
-- en tjänst utan att någon kod behöver veta vilken den är. Alla har
-- ett förval, och förvalet är precis hur läxhjälpen fungerar i dag:
--
--   ersattning_per_timme_ore  null  = studiehjälparens egen timpenning
--                                     (tutor_profiles.hourly_rate) gäller
--   bokningstyp               'pass' = bokas i hela timmar i kalendern
--   krav                      {}    = inga krav utöver dagens
--   min_alder                 null  = ingen åldersgräns
--   rapportkrav               true  = ett pass utan rapport faktureras inte
--   rut_berattigad / _procent false / 0 = ingen skattereduktion
--   kundtyp                   'privat'
--   jobbtyp                   'studiehjalpare'
--   matchningsregler          {}    = matchningen som i dag
--
-- De inaktiva tjänsterna (barnvakt, hushållsnära, försäljning) får
-- samma förval. Deras riktiga värden sätts när de aktiveras (Fas 10) —
-- att gissa en ersättning eller en RUT-andel nu vore att hitta på.
--
-- Policyerna är oförändrade: anon och inloggade läser bara aktiva rader
-- (Fas 1.6), admin ändrar.

alter table public.tjanster
  add column ersattning_per_timme_ore bigint,
  add column bokningstyp      text     not null default 'pass',
  add column krav             jsonb    not null default '{}'::jsonb,
  add column min_alder        integer,
  add column rapportkrav      boolean  not null default true,
  add column rut_berattigad   boolean  not null default false,
  add column rut_procent      smallint not null default 0,
  add column kundtyp          text     not null default 'privat',
  add column jobbtyp          text     not null default 'studiehjalpare',
  add column matchningsregler jsonb    not null default '{}'::jsonb;

alter table public.tjanster
  add constraint tjanster_ersattning_check
    check (ersattning_per_timme_ore is null or ersattning_per_timme_ore >= 0),
  add constraint tjanster_bokningstyp_check
    check (bokningstyp in ('pass', 'forfragan')),
  add constraint tjanster_krav_check
    check (jsonb_typeof(krav) = 'object'),
  add constraint tjanster_min_alder_check
    check (min_alder is null or (min_alder > 0 and min_alder < 100)),
  -- En andel utan berättigande, eller tvärtom, är ett halvt beslut.
  add constraint tjanster_rut_check
    check (rut_procent between 0 and 100
           and (rut_berattigad = (rut_procent > 0))),
  add constraint tjanster_kundtyp_check
    check (kundtyp in ('privat', 'foretag', 'bada')),
  add constraint tjanster_jobbtyp_check
    check (jobbtyp ~ '^[a-z][a-z_]{1,39}$'),
  add constraint tjanster_matchningsregler_check
    check (jsonb_typeof(matchningsregler) = 'object');

comment on column public.tjanster.ersattning_per_timme_ore is
  'Ersättning till den som utför tjänsten, öre per timme. Null = studiehjälparens egen timpenning (tutor_profiles.hourly_rate).';
comment on column public.tjanster.bokningstyp is
  'pass = bokas i hela timmar i kalendern (läxhjälp). forfragan = kunden skickar en förfrågan som Nextrum planerar.';
comment on column public.tjanster.rapportkrav is
  'true = ett pass utan rapport faktureras inte och kan inte bli genomfört.';
comment on column public.tjanster.rut_procent is
  'Skattereduktionens andel av arbetskostnaden i procent. 0 när tjänsten inte är RUT-berättigad.';
