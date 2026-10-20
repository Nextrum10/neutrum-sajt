-- ============================================================
-- Provet i ansökan tas bort (2026-10-21)
--
-- Leo, 2026-10-20: "ta bort gamla och ersätt med nya på 26 frågor, 55% rätt
-- släpper in läxhjälparen i sin vy, provet ska bara göras en gång, vid
-- aktivering av konto. först välja lösenord och sen provet". Det enda provet
-- är sedan dess det i studiehjälparvyn (utbildningsprovet_i_studiehjalparvyn),
-- som görs direkt efter att lösenordet är valt. Provet i ansökan (Fas 22.1:
-- utbildningsprov.html, edge-funktionen utbildningsprov, applications.prov_*,
-- utbildningsprov_forsok) gjorde ingen: ingen ansökan fick ett prov öppnat,
-- och tabellen med försöken var tom när filen skrevs.
--
--   1. Utbildningsmötet öppnar inget prov: intern.utbildningsprov_oppnas
--      lämnar raden som den är, så sista dagen och nyckeln sätts aldrig.
--   2. Inget mejl om provet: grenen i intern.ansokan_besked som köade 'prov'
--      tas bort, jobbet utbildningsprov-paminn tas ur pg_cron, och
--      intern.utbildningsprov_paminn köar inget om den körs ändå. Ett nytt
--      villkor på ansokan_utskick säger nej till provets tre steg, så att
--      inget provmejl kan köas härifrån heller.
--   3. Ingen kör provets två funktioner, inte heller tjänstekontot: sidan och
--      edge-funktionen finns inte i repot, och funktionen som står kvar i
--      driften tills den tas bort i Supabases panel når ingenting.
--   4. Kolumnerna, försökstabellen, villkoret på ansokan_utskick och
--      skydda_ansokningsfalt står kvar som historik. Att ta bort dem är drop,
--      och de är tomma.
--
-- Mejlet om sista steget (sista_steget) går som förut när admin markerar den
-- sökande som utbildad; förut gick det också när provet klarades.
--
-- Inget drop och inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes, och inget prov är öppet ----------
do $$
declare
  def text;
begin
  if exists (select 1 from public.applications a
              where a.prov_sista_dag >= (now() at time zone 'Europe/Stockholm')::date
                and a.prov_godkant_at is null and a.utbildad_at is null
                and a.status is distinct from 'rejected') then
    raise exception 'Ett prov i ansökan är öppet. Låt det gå ut, eller markera hen som utbildad, innan filen körs.';
  end if;
  if exists (select 1 from public.ansokan_utskick u
              where u.steg in ('prov', 'prov_paminnelse', 'prov_sista_dagen')) then
    raise exception 'Ett provmejl står i ansokan_utskick. Läs driften och skriv om filen: villkoret i avsnitt 2 säger nej till raden.';
  end if;
  def := pg_get_functiondef('intern.ansokan_besked()'::regprocedure);
  if position('provet_i_ansokan_tas_bort' in def) = 0 and md5(def) <> '9d0ea3e3fbd689cbcd886999ba027bd1' then
    raise exception 'intern.ansokan_besked har ändrats sedan filen skrevs (md5 %). Läs driften och skriv om filen.',
      md5(def);
  end if;
end $$;


-- ---------- 1. mötet öppnar inget prov ----------
create or replace function intern.utbildningsprov_oppnas()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- provet_i_ansokan_tas_bort (2026-10-21): utbildningsmötet öppnar inget prov.
-- Det enda provet görs i studiehjälparvyn, direkt efter lösenordet, så
-- sista dagen och nyckeln sätts inte längre. Triggern står kvar, och raden
-- går igenom som den är.
begin
  return new;
end $function$;

revoke all on function intern.utbildningsprov_oppnas() from public, anon, authenticated;


-- ---------- 2. inget mejl om provet ----------
do $$
declare
  def  text;
  gren constant text := $gren$    -- Fas 22.1: provet öppnas, eller öppnas igen med nya dagar. Nyckeln
    -- bär sista dagen, så varje fönster mejlas en gång.
    if new.prov_sista_dag is not null
       and new.prov_sista_dag is distinct from old.prov_sista_dag
       and new.prov_sista_dag >= (now() at time zone 'Europe/Stockholm')::date
       and new.prov_godkant_at is null and new.utbildad_at is null
       and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'prov', 'prov:' || new.prov_sista_dag);
    end if;
$gren$;
  ny   constant text := $ny$    -- provet_i_ansokan_tas_bort (2026-10-21): inget mejl om ett prov köas
    -- härifrån. Det enda provet görs i studiehjälparvyn, och sista steget
    -- mejlas när admin markerar den sökande som utbildad (nedan).
$ny$;
  n    integer;
begin
  def := pg_get_functiondef('intern.ansokan_besked()'::regprocedure);
  if position('provet_i_ansokan_tas_bort' in def) > 0 then
    return;
  end if;
  n := (char_length(def) - char_length(replace(def, gren, ''))) / char_length(gren);
  if n <> 1 then
    raise exception 'intern.ansokan_besked: provets gren träffade % ställen, inte ett.', n;
  end if;
  execute replace(def, gren, ny);
end $$;

create or replace function intern.utbildningsprov_paminn()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- provet_i_ansokan_tas_bort (2026-10-21): provet i ansökan finns inte, och
-- inga påminnelser om det köas. Jobbet som körde funktionen är borttaget.
begin
  return 0;
end $function$;

revoke all on function intern.utbildningsprov_paminn() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'utbildningsprov-paminn') then
    perform cron.unschedule('utbildningsprov-paminn');
  end if;
end $$;

-- Villkoret på steg (ansokan_utskick_steg_check) står kvar med provets
-- tre steg som historik, för att skriva om det är drop. Det här säger nej
-- till dem i stället. intern.ansokan_besked fångar sina egna fel, så ett
-- försök att köa ett provmejl blir en varning, aldrig ett stoppat klick.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.ansokan_utskick'::regclass
                    and conname = 'ansokan_utskick_inga_provmejl') then
    alter table public.ansokan_utskick
      add constraint ansokan_utskick_inga_provmejl
      check (steg <> all (array['prov', 'prov_paminnelse', 'prov_sista_dagen']));
  end if;
end $$;


-- ---------- 3. ingen kör provets funktioner ----------
revoke all on function public.utbildningsprov_lage(uuid) from public, anon, authenticated, service_role;
revoke all on function public.utbildningsprov_lamna(uuid, integer, integer, jsonb)
  from public, anon, authenticated, service_role;

comment on function public.utbildningsprov_lage(uuid) is
  'Provet i ansökan (Fas 22.1), borttaget 2026-10-21 (provet_i_ansokan_tas_bort): ingen kör funktionen. '
  'Det enda provet görs i studiehjälparvyn (mitt_utbildningsprov).';
comment on function public.utbildningsprov_lamna(uuid, integer, integer, jsonb) is
  'Provet i ansökan (Fas 22.1), borttaget 2026-10-21 (provet_i_ansokan_tas_bort): ingen kör funktionen. '
  'Det enda provet görs i studiehjälparvyn (lamna_in_utbildningsprov).';


-- ---------- 4. historiken ----------
comment on table public.utbildningsprov_forsok is
  'Försöken i provet i ansökan (Fas 22.1), borttaget 2026-10-21 (provet_i_ansokan_tas_bort). Tom när provet '
  'togs bort; står kvar som historik. Provet i studiehjälparvyn sparar sina försök i prov_forsok.';
comment on column public.applications.prov_sista_dag is
  'Provet i ansökan (Fas 22.1), borttaget 2026-10-21: sätts inte längre.';
comment on column public.applications.prov_nyckel is
  'Provet i ansökan (Fas 22.1), borttaget 2026-10-21: sätts inte längre.';
comment on column public.applications.prov_godkant_at is
  'Provet i ansökan (Fas 22.1), borttaget 2026-10-21: sätts inte längre. Provet i studiehjälparvyn står i '
  'prov_studiehjalpare.utbildningsprov_godkant_at.';
