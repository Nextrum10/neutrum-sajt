-- ============================================================
-- Koderna: en ägare, aldrig den egna, och en rabattkod en gång per
-- familj (2026-10-21)
--
-- Beställningen (Leo, 2026-10-21): "Koder är rabatt- och värvningskoder
-- som admin lägger ut hos familjer och lärare, och som kan användas av
-- andra (familj till familj, lärare till lärare)." Koden har en ägare,
-- "vem koden är utlagd hos", och reglerna: "en kod per köp, ingen
-- stapling. Man kan inte använda sin egen kod. En familj kan använda samma
-- kod högst en gång."
--
-- Det mesta fanns sedan koder_for_planer (2026-10-21): en kod per köp
-- (klippkort.rabattkod), prövningen och rabatten i databasen innan kassan
-- öppnas, aldrig ett gratis köp, bara planer, och koder och användningar
-- som aldrig raderas. Det här lägger till:
--
--   1. rabattkoder.agare: familjen eller studiehjälparen koden är utlagd
--      hos. En förälder eller studiehjälpare som finns, aldrig ett barn,
--      och null när ägaren tas bort. Auditen får id:t.
--   2. Den egna koden: intern.rabattkod_prova säger nej till ägaren, så
--      att kassan (kod_pa_planen) och köpet (intern.klippkort_rabatt)
--      nekar den båda.
--   3. En rabattkod gäller en gång per familj: max_per_familj är 1 för
--      varje kod av sorten rabatt (villkoret rabattkoder_rabatt_en_gang).
--      En partnerkod behåller sin gräns som admin satt den: den finns för
--      att räkna vad föreningens familjer köper (Leo 2026-10-21, "spårar
--      partnerföreningars volym"), och en gräns på en gång hade bara räknat
--      det första köpet.
--
-- "galler_for (planer/alla)" byggs inte: koderna gäller bara planer
-- (koder_for_planer, Leo samma dag: "Båda gäller ENBART planköp, aldrig
-- enskilda pass"), och ett pass tar ingen kod (bookings_kod_bara_pa_planer).
-- "Ingen stapling" är en kod per köp; familjens rabatt och den första
-- planens gratis timme är inga koder och staplas med den, som Leo
-- bestämde 2026-10-15.
--
-- Funktionen som lappas prövas mot driften som den byggs ur migrationerna,
-- och en som redan bär ändringen släpps igenom, så filen går att köra två
-- gånger. Villkoret läggs bara om det saknas. Inget drop och inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 1. ägaren ----------
alter table public.rabattkoder
  add column if not exists agare uuid references public.profiles(id) on delete set null;
create index if not exists rabattkoder_agare on public.rabattkoder (agare) where agare is not null;

comment on column public.rabattkoder.agare is
  '2026-10-21 (koderna_agare_och_en_gang). Familjen eller studiehjälparen koden är utlagd hos, eller null. Ägaren kan '
  'inte använda koden själv (intern.rabattkod_prova). Null när kontot tas bort.';

create or replace function intern.kodens_agare()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- koderna_agare_och_en_gang (2026-10-21). En kod läggs ut hos en förälder
-- eller en studiehjälpare som finns, aldrig hos ett barn eller ett konto
-- som tagits bort.
begin
  if new.agare is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.agare is not distinct from old.agare then
    return new;
  end if;
  if not exists (select 1 from public.profiles p
                  where p.id = new.agare and p.role in ('parent', 'tutor') and p.raderad_at is null) then
    raise exception using errcode = '23514',
      message = 'En kod läggs ut hos en familj eller en studiehjälpare som finns.';
  end if;
  return new;
end $function$;

revoke all on function intern.kodens_agare() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.rabattkoder'::regclass
                  and tgname = 'rabattkoder_agare') then
    create trigger rabattkoder_agare
      before insert or update of agare on public.rabattkoder
      for each row execute function intern.kodens_agare();
  end if;
end $$;

-- Auditen får ägarens id, inget namn, som de andra kolumnerna.
create or replace trigger rabattkoder_audit
  after insert or delete or update on public.rabattkoder
  for each row execute function public.logga_andring('rabattkod', 'kod', 'aktiv', 'typ', 'varde', 'tjanst',
                                                     'giltig_fran', 'giltig_till', 'max_anvandningar',
                                                     'max_per_familj', 'sort', 'agare');


-- ---------- 2. aldrig den egna koden ----------
do $$
declare
  def  text;
  fore constant text := '  if r.giltig_fran is not null and idag < r.giltig_fran then';
  ny   constant text := '  -- koderna_agare_och_en_gang (2026-10-21): den som koden är utlagd hos' || chr(10)
                     || '  -- använder den inte själv.' || chr(10)
                     || '  if r.agare is not null and p_familj is not null and r.agare = p_familj then' || chr(10)
                     || '    return query select false, ''Det är er egen kod. Den är till för andra familjer.''::text,' || chr(10)
                     || '                        0::bigint, null::text;' || chr(10)
                     || '    return;' || chr(10)
                     || '  end if;' || chr(10) || chr(10)
                     || fore;
  n integer;
begin
  def := pg_get_functiondef('intern.rabattkod_prova(text, text, bigint, uuid, boolean)'::regprocedure);
  if position('koderna_agare_och_en_gang' in def) > 0 then
    return;
  end if;
  n := (char_length(def) - char_length(replace(def, fore, ''))) / char_length(fore);
  if n <> 1 then
    raise exception 'intern.rabattkod_prova: platsen för den egna koden träffade % ställen, inte ett. Läs driften och skriv om migrationen.', n;
  end if;
  execute replace(def, fore, ny);
end $$;


-- ---------- 3. en rabattkod gäller en gång per familj ----------
-- Gränsen sätts av databasen, så att en rabattkod aldrig står utan den
-- (ett CHECK-villkor släpper igenom null). Villkoret är backstoppet.
create or replace function intern.rabattkod_en_gang()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- koderna_agare_och_en_gang (2026-10-21): Leo, "En familj kan använda samma
-- kod högst en gång". En partnerkod behåller den gräns admin satt.
begin
  if new.sort = 'rabatt' then
    new.max_per_familj := 1;
  end if;
  return new;
end $function$;

revoke all on function intern.rabattkod_en_gang() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.rabattkoder'::regclass
                  and tgname = 'rabattkoder_en_gang') then
    create trigger rabattkoder_en_gang
      before insert or update on public.rabattkoder
      for each row execute function intern.rabattkod_en_gang();
  end if;
end $$;

-- TIPS är sorten rabatt men aldrig aktiv; den får samma gräns.
update public.rabattkoder set max_per_familj = 1
 where sort = 'rabatt' and max_per_familj is distinct from 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.rabattkoder'::regclass
                  and conname = 'rabattkoder_rabatt_en_gang') then
    alter table public.rabattkoder
      add constraint rabattkoder_rabatt_en_gang check (sort <> 'rabatt' or max_per_familj is not distinct from 1);
  end if;
end $$;

comment on column public.rabattkoder.max_per_familj is
  'Hur många köp en familj gör med koden. En rabattkod: alltid 1 (rabattkoder_rabatt_en_gang, 2026-10-21). En '
  'partnerkod: som admin satt den, null utan gräns. Ett återbetalt köp ger tillbaka sin gång.';


-- ---------- 4. två kassor med samma kod (granskningen 2026-10-21) ----------
/* En kod med en gräns per familj räknade bara familjens betalda köp, så två
   kassor öppna samtidigt (Basic i en flik, Standard i en annan) gav
   rabatten två gånger. Nu räknar köpet också familjens egna kassor med
   koden som öppnats den senaste timmen, under kodens radlås: den andra
   kassan öppnas utan koden (stripe-checkout säger det och öppnar ingen
   kassa). Den som lämnat en kassa kan använda koden på en annan plan efter
   en timme, och samma plan igen återanvänder det väntande köpet. Betalas
   ändå två köp med koden blir det en uppgift till oss
   (kod_anvandningar_for_manga), för pengarna har då redan rört sig. */
do $lapp$
declare
  fore    text;
  traffar integer;
  a1 text := $a$  perform 1 from public.rabattkoder where kod = new.rabattkod for update;$a$;
  b1 text := $b$  perform 1 from public.rabattkoder where kod = new.rabattkod for update;
  -- koderna_agare_och_en_gang (granskningen 2026-10-21): familjens egna
  -- kassor med koden den senaste timmen räknas mot gränsen per familj.
  if (select r.max_per_familj from public.rabattkoder r where r.kod = new.rabattkod) is not null
     and intern.rabattkod_anvand(new.rabattkod, new.parent_id, false)
         + (select count(*) from public.klippkort x
             where x.parent_id = new.parent_id and x.rabattkod = new.rabattkod and x.status = 'vantar'
               and x.id <> new.id and x.created_at > now() - interval '1 hour')
         >= (select r.max_per_familj from public.rabattkoder r where r.kod = new.rabattkod) then
    new.rabattkod := null;
    new.rabatt_ore := null;
    new.begart_ore := pris - fam;
    return new;
  end if;$b$;
begin
  fore := pg_get_functiondef('intern.klippkort_rabatt()'::regprocedure);
  if position('granskningen 2026-10-21' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'klippkort_rabatt: % träffar på kodens radlås. Läs driften.', traffar;
  end if;
  execute replace(fore, a1, b1);
end $lapp$;

create or replace function intern.kod_anvandningar_for_manga()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- koderna_agare_och_en_gang (granskningen 2026-10-21).
declare
  per integer := (select r.max_per_familj from public.rabattkoder r where r.kod = new.kod);
  n   integer;
begin
  if per is null then
    return null;
  end if;
  select count(*) into n from public.kod_anvandningar a where a.kod = new.kod and a.familj = new.familj;
  if n > per then
    perform public.skapa_uppgift(
      'En familj har använt en kod fler gånger än den gäller',
      'kod_for_manga:' || new.kod || ':' || new.familj,
      'problem',
      format('Koden %s gäller %s gång(er) per familj och har nu använts %s gånger av samma familj, '
             || 'troligen i två kassor som var öppna samtidigt. Betalningarna står i Liggaren: '
             || 'ta ut mellanskillnaden eller låt det vara.', new.kod, per, n),
      'profiles', new.familj::text);
  end if;
  return null;
exception when others then
  -- En uppgift får aldrig stoppa bokföringen av en betalning.
  return null;
end $function$;

revoke all on function intern.kod_anvandningar_for_manga() from public, anon, authenticated;

create or replace trigger kod_anvandningar_for_manga
  after insert on public.kod_anvandningar
  for each row execute function intern.kod_anvandningar_for_manga();
