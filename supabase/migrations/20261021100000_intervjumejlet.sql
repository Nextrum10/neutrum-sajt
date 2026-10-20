-- ============================================================
-- Mejlet till den som går vidare till intervju (2026-10-21)
--
-- Beställningen (Leo, 2026-10-21): när admin skickar en ansökan vidare
-- till intervju köas ett mejl till den som sökt, genom notiskön, högst
-- en gång per ansökan, och tidpunkten sätts av databasen
-- (intervju_mejl_skickat_at). Texten är Leos, ord för ord, och står i
-- supabase/functions/_delad/notiser/intervju.ts.
--
-- Varför notiskön och inte ansokan-notis, som tar de andra mejlen till
-- den som söker: kön följer sandlådan (notis_drift.mejl_sandlada) och
-- strömbrytaren notiser_mejl i notis_utskick_ta, och det är det Leo
-- bett om, att mejlet följer läget. notis_konfig.lage rörs inte: den
-- kolumnen är en rest från den gamla kön i driften och läses inte av
-- någon kod (minne/notiser.md).
--
--   1. applications.intervju_mejl_skickat_at: när mejlet köades. Bara
--      databasen sätter den, och den står kvar: att ångra steget och
--      skicka vidare igen ger inget nytt mejl.
--   2. notis_utskick.ansokan_id: en tredje sorts mottagare, bredvid
--      kontot (mottagare) och barnet (barn_id). Villkoret
--      notis_utskick_en_mottagare kräver nu exakt en av de tre. Raden
--      tas bort med ansökan.
--   3. intern.ansokan_intervjumejl() (triggern applications_till_intervju,
--      efter applications_skydda i namnordning): köar mejlet när
--      till_intervju_at går från tom till satt, om mejlet inte gått, om
--      ansökan inte är avböjd och har en adress, och om steget inte kom
--      med ett bokat möte i samma ändring (Boka möte sätter steget och
--      mötet samtidigt, och då är mötesmejlet inbjudan) eller med ett
--      mejl vi skrivit (Skriv till hen med bokningssidan sätter steget och
--      kontaktad_at samtidigt, 2026-10-20, och då är det kallelsen). Kön har en
--      unik nyckel per ansökan (ansokan_intervju:<id>), så inte heller
--      två samtidiga ändringar ger två mejl.
--   4. notis_utskick_ta: en rad med ansokan_id prövas med läget just nu
--      (ansökan finns, står kvar i intervju och är inte avböjd), går
--      till adressen i ansökan eller till sandlådan, och lämnas ut med
--      rollen 'sokande' och ansökans id som mottagare.
--
-- FILEN BYTER ETT VILLKOR (avsnitt 2), och det kräver ett drop
-- constraint. Verktygen som ändrar driften ber om en bekräftelse för
-- det (CLAUDE.md avsnitt 5): kör filen i SQL Editor som ett anrop, eller
-- avsnitt för avsnitt med execute_sql, och registrera filens text
-- efteråt. Funktionen som lappas prövas mot driften som den byggs ur
-- migrationerna (md5); en som redan bär ansokan_id släpps igenom, så
-- filen går att köra två gånger. Inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  def text;
begin
  def := pg_get_functiondef('public.notis_utskick_ta(integer)'::regprocedure);
  if position('ansokan_id' in def) = 0 and md5(def) <> '3ca36091b3b70932293f1f137c7ba718' then
    raise exception 'notis_utskick_ta har ändrats sedan intervjumejlet skrevs (md5 %). Läs driften och skriv om migrationen.',
      md5(def);
  end if;
end $$;


-- ---------- 1. tidpunkten på ansökan ----------
alter table public.applications
  add column if not exists intervju_mejl_skickat_at timestamptz;

comment on column public.applications.intervju_mejl_skickat_at is
  '2026-10-21 (intervjumejlet). När mejlet "Du går vidare till intervju" köades i notiskön. Sätts bara av '
  'intern.ansokan_intervjumejl, när till_intervju_at går från tom till satt, och står sedan kvar: ett mejl per ansökan.';


-- ---------- 2. en ansökan som mottagare i kön ----------
alter table public.notis_utskick
  add column if not exists ansokan_id uuid references public.applications(id) on delete cascade;

comment on column public.notis_utskick.ansokan_id is
  '2026-10-21 (intervjumejlet). Mottagaren när mejlet går till den som sökt jobb, som inte har ett konto. Exakt en '
  'av mottagare, barn_id och ansokan_id (notis_utskick_en_mottagare).';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.notis_utskick'::regclass and conname = 'notis_utskick_en_mottagare'
                    and pg_get_constraintdef(oid) like '%ansokan_id%') then
    alter table public.notis_utskick drop constraint if exists notis_utskick_en_mottagare;
    alter table public.notis_utskick
      add constraint notis_utskick_en_mottagare check (num_nonnulls(mottagare, barn_id, ansokan_id) = 1);
  end if;
end $$;

create index if not exists notis_utskick_ansokan on public.notis_utskick (ansokan_id) where ansokan_id is not null;


-- ---------- 3. mejlet köas när steget sätts ----------
create or replace function intern.ansokan_intervjumejl()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- intervjumejlet (2026-10-21). Körs efter applications_skydda (namnordning),
-- så steget den ser är det som faktiskt sparas.
begin
  if tg_op = 'INSERT' then
    new.intervju_mejl_skickat_at := null;
    return new;
  end if;

  -- Bara den här funktionen sätter tidpunkten, och den står kvar.
  new.intervju_mejl_skickat_at := old.intervju_mejl_skickat_at;

  if old.till_intervju_at is null and new.till_intervju_at is not null
     and old.intervju_mejl_skickat_at is null
     and new.status is distinct from 'rejected'
     -- Boka möte sätter steget och mötet i samma ändring: då är mötesmejlet inbjudan.
     and not (new.mote_tid is not null and old.mote_tid is null)
     -- Skriv till hen med bokningssidan sätter steget och kontaktad_at i samma
     -- ändring (2026-10-20): då är det mejlet kallelsen, och det här går inte.
     and new.kontaktad_at is not distinct from old.kontaktad_at
     and nullif(btrim(coalesce(new.email, '')), '') is not null then
    insert into public.notis_utskick (ansokan_id, kanal, typ, data, idempotens, skicka_efter)
    values (new.id, 'mejl', 'ansokan_intervju', '{}'::jsonb, 'ansokan_intervju:' || new.id::text, now())
    on conflict (idempotens) do nothing;
    new.intervju_mejl_skickat_at := now();
  end if;
  return new;
end $function$;

revoke all on function intern.ansokan_intervjumejl() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.applications'::regclass
                  and tgname = 'applications_till_intervju') then
    create trigger applications_till_intervju
      before insert or update on public.applications
      for each row execute function intern.ansokan_intervjumejl();
  end if;
end $$;


-- ---------- 4. kön lämnar ut ansökans rad ----------
do $$
declare
  def  text;
  ny   text;
  var1 constant text := '  bs       public.students%rowtype;' || chr(10);
  var2 constant text := '  bs       public.students%rowtype;' || chr(10)
                     || '  an       public.applications%rowtype;' || chr(10);
  fore constant text := '    prov := coalesce((u.data ->> ''prov'')::boolean, false);';
  gren constant text := $gren$    /* EN ANSÖKAN (intervjumejlet, 2026-10-21). En rad med ansokan_id går
       till adressen i ansökan: den som sökt jobb har inget konto. Den
       prövas med läget just nu: att ansökan finns, står kvar i intervju
       och inte är avböjd. Flaggan och sandlådan gäller som för alla. */
    if u.ansokan_id is not null then
      skal := null;
      select * into an from public.applications a where a.id = u.ansokan_id;
      if u.skicka_senast is not null and u.skicka_senast < now() then
        skal := 'för sent';
      elsif u.kanal <> 'mejl' or u.typ <> 'ansokan_intervju' then
        skal := 'en ansökan får bara intervjumejlet';
      elsif an.id is null then
        skal := 'ansökan finns inte längre';
      elsif an.status = 'rejected' then
        skal := 'ansökan är avböjd';
      elsif an.till_intervju_at is null then
        skal := 'ansökan står inte längre i intervju';
      end if;

      if skal is not null then
        update public.notis_utskick q set status = 'hoppad', fel = skal, uppdaterad = now() where q.id = u.id;
        continue;
      end if;

      if mejl_pa then
        adress := nullif(btrim(coalesce(an.email, '')), '');
      elsif drift.mejl_sandlada is not null then
        adress := drift.mejl_sandlada;
      else
        update public.notis_utskick q set status = 'loggad', uppdaterad = now() where q.id = u.id;
        continue;
      end if;
      if adress is null then
        update public.notis_utskick q set status = 'fel', fel = 'ansökan saknar e-postadress', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;
      if lower(adress) like '%@barn.nextrum.se' then
        update public.notis_utskick q set status = 'hoppad', fel = 'barnkonton får inga mejl', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;

      update public.notis_utskick q
         set status = 'skickar', lanad_till = now() + interval '5 minutes', forsok = q.forsok + 1,
             till_sandlada = not mejl_pa, uppdaterad = now()
       where q.id = u.id;

      return query
        select u.id, u.ansokan_id, u.kanal, u.typ, u.antal, u.data, 'sokande'::text,
               intern.fornamn(an.name), adress, null::text, not mejl_pa, drift.sms_lage;
      continue;
    end if;

$gren$;
  n integer;
begin
  def := pg_get_functiondef('public.notis_utskick_ta(integer)'::regprocedure);
  if position('ansokan_id' in def) > 0 then
    return;
  end if;
  n := (char_length(def) - char_length(replace(def, var1, ''))) / char_length(var1);
  if n <> 1 then
    raise exception 'notis_utskick_ta: deklarationen träffade % ställen, inte ett.', n;
  end if;
  n := (char_length(def) - char_length(replace(def, fore, ''))) / char_length(fore);
  if n <> 1 then
    raise exception 'notis_utskick_ta: platsen för grenen träffade % ställen, inte ett.', n;
  end if;
  ny := replace(replace(def, var1, var2), fore, gren || fore);
  execute ny;
end $$;

comment on function public.notis_utskick_ta(integer) is
  'Lånar ut rader ur notis_utskick som ska skickas nu, med adressen vald (kontot, barnets bekräftade adress, '
  'ansökans adress eller sandlådan). Bara service_role. Sedan 2026-10-21 också mejlet till den som går vidare till '
  'intervju (ansokan_id, rollen sokande).';
