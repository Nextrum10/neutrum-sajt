-- ============================================================
-- NEXTRUM — Fas 9.8: auditloggen går att söka i
--
-- Loggen hämtades med .limit(300) och filtrerades sedan i
-- webbläsaren. Det fungerar medan loggen är tom. Det slutar
-- fungera tyst: när rad 301 finns visar filtret "Faktura" bara de
-- fakturahändelser som råkade rymmas i de 300 senaste raderna, och
-- antalet under rubriken blir antalet träffar BLAND dem — inte
-- antalet träffar. En logg som svarar fel på "hur många gånger
-- hände det" är sämre än ingen logg.
--
-- Tre delar:
--
--   1. objekt_typ som genererad kolumn. Sorten står redan i
--      handling ('pass.status'), men före punkten. Ett uttryck i
--      varje fråga hade inte kunnat indexeras.
--   2. index för de tre frågorna gränssnittet faktiskt ställer:
--      sort + tid, vem + tid, och tid ensamt (finns redan).
--   3. audit_sok() som filtrerar OCH räknar i databasen. Totalen
--      kommer ur count(*) over () på den filtrerade mängden, alltså
--      före limit — det är hela poängen.
--
-- SECURITY INVOKER, alltså ingen särskild rättighet: policyn
-- "admin läser auditloggen" gäller inuti funktionen precis som
-- utanför. En sökfunktion som är DEFINER hade varit en väg förbi
-- den policyn, och loggen är det sista stället att bygga en sådan.
--
-- AI-MÄRKNINGEN LÄSES INTE UR aktor_typ.
--
-- Frestelsen är aktor_typ = 'ai'. Den vore falsk: drift-agenten
-- talar med databasen genom adminens egen token, så auth.uid() ÄR
-- adminen och aktor_typ blir 'admin'. Det är med flit — det är så
-- skydda_*-triggrarna fortsätter gälla. En rad märks därför som
-- AI-initierad genom att den sammanfaller med ett UTFÖRT förslag
-- på samma objekt: godkann_forslag sätter utford = now(), och
-- auditraden får samma now() eftersom det är samma transaktion.
-- Dessutom märks förslag som kom ur en agentkörning (korning_id).
-- ============================================================

alter table public.audit_logg
  add column if not exists objekt_typ text
    generated always as (split_part(handling, '.', 1)) stored;

comment on column public.audit_logg.objekt_typ is
  'Sorten ur handling, före punkten. Genererad: den kan inte glida isär.';

create index if not exists audit_logg_typ_tid_idx
  on public.audit_logg (objekt_typ, tid desc);
create index if not exists audit_logg_aktor_tid_idx
  on public.audit_logg (aktor, tid desc);

drop function if exists public.audit_sok(text, uuid, date, date, boolean, integer, integer);

create function public.audit_sok(
  p_objekt_typ text    default null,
  p_aktor      uuid    default null,
  p_fran       date    default null,
  p_till       date    default null,
  p_bara_ai    boolean default false,
  p_limit      integer default 50,
  p_offset     integer default 0)
returns table (
  id         bigint,
  tid        timestamptz,
  aktor      uuid,
  aktor_typ  text,
  handling   text,
  objekt_typ text,
  tabell     text,
  objekt_id  text,
  fore       jsonb,
  efter      jsonb,
  fran_ai    boolean,
  totalt     bigint)
language sql
stable
set search_path to 'public'
as $$
  with valda as (
    select a.id, a.tid, a.aktor, a.aktor_typ, a.handling, a.objekt_typ,
           a.tabell, a.objekt_id, a.fore, a.efter,
           (exists (select 1 from public.ai_forslag f
                     where f.status = 'utford'
                       and f.kopplad_tabell = a.tabell
                       and f.kopplad_id = a.objekt_id
                       and f.utford = a.tid)
            or (a.tabell = 'ai_forslag'
                and exists (select 1 from public.ai_forslag f2
                             where f2.id::text = a.objekt_id
                               and f2.korning_id is not null))) as fran_ai
      from public.audit_logg a
     where (p_objekt_typ is null or a.objekt_typ = p_objekt_typ)
       and (p_aktor is null or a.aktor = p_aktor)
       -- Dagsgränserna räknas i Europe/Stockholm. Räknade i UTC hade
       -- "idag" börjat klockan två på natten halva året.
       and (p_fran is null or a.tid >= (p_fran::timestamp at time zone 'Europe/Stockholm'))
       and (p_till is null or a.tid <  ((p_till + 1)::timestamp at time zone 'Europe/Stockholm'))
  )
  select v.id, v.tid, v.aktor, v.aktor_typ, v.handling, v.objekt_typ,
         v.tabell, v.objekt_id, v.fore, v.efter, v.fran_ai,
         count(*) over () as totalt
    from valda v
   where not coalesce(p_bara_ai, false) or v.fran_ai
   order by v.tid desc, v.id desc
   limit  greatest(1, least(coalesce(p_limit, 50), 200))
  offset  greatest(0, coalesce(p_offset, 0));
$$;

revoke execute on function
  public.audit_sok(text, uuid, date, date, boolean, integer, integer) from public, anon;
grant execute on function
  public.audit_sok(text, uuid, date, date, boolean, integer, integer) to authenticated;

comment on function public.audit_sok(text, uuid, date, date, boolean, integer, integer) is
  'Söker i auditloggen och räknar träffarna i databasen. totalt är antalet '
  'rader filtret ger, inte antalet som ryms i limit. SECURITY INVOKER: '
  'policyn admin läser auditloggen gäller.';
