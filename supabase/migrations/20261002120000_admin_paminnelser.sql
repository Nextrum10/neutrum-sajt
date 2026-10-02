-- ============================================================
-- NEXTRUM — admin får ett mejl när något legat en timme i Att göra
-- (2026-10-02)
--
-- Leo 2026-10-02: "varje gång det kommer upp en sak att göra i admin,
-- efter en timme om den saken är kvar att göra, skicka mail till
-- administratörerna", bland annat en jobbansökan, en intresseanmälan och
-- en rapport som familjen inte bekräftat en timme efter att passet blev
-- genomfört.
--
--
-- LISTAN STÅR PÅ TVÅ STÄLLEN, MED FLIT
--
-- Att göra i adminvyn räknas i webbläsaren (byggAttGöra i
-- nextrum-admin-oversikt.js). Ett mejl en timme senare kan inte vänta på
-- att någon har vyn öppen, så databasen räknar samma lista själv i
-- intern.admin_att_gora(): en rad per sak (typ + id), inte ett antal.
-- Ändras listan i vyn ska funktionen ändras i samma ändring, och tvärtom.
-- Två saker finns bara här: rapporten som familjen inte bekräftat
-- (rapport_obekraftad) och uppgifterna som systemet själv lagt
-- (uppgift). De som en människa lagt in själv räknas inte: den som skrev
-- dem vet redan om dem.
--
-- "Genomfört" är att rapporten finns (CLAUDE.md avsnitt 1), så en
-- timme räknas från att rapporten blev synlig i listan, inte från passets
-- sluttid. Ett pass som aldrig fick någon rapport är en annan sak, och
-- står i Att göra som "pass saknar rapport" dagen efter.
--
--
-- EN SAK FÅR ETT MEJL, INTE ETT PER MINUT
--
-- admin_paminnelser minns när varje sak först syntes (forst_sedd_at) och
-- om den redan mejlats (mejlad_at). Lämnar saken listan raderas raden, så
-- en sak som kommer tillbaka räknas som en ny. Sakerna som mognat sedan
-- förra gången går i ETT mejl (admin_paminnelse_utskick), och högst ett
-- mejl per kvart: en studiehjälpare som rapporterar fem pass på kvällen
-- ska inte ge fem mejl.
--
-- Mejlet har antal per sort och en knapp till adminvyn, aldrig namn,
-- adresser eller text ur raderna (_delad/notiser/admin.ts).
--
--
-- VEM FÅR DET
--
-- Superadminarna. Att göra är bara deras vy (BARA_SUPER i
-- nextrum-admin-behorighet.js), och en admin med behörigheter ska inte få
-- veta att det finns fakturor att lägga in. Adresserna läses i
-- admin_paminnelse_ta() och lämnar aldrig databasen utom till
-- edge-funktionen.
--
--
-- DET SOM FANNS FÖRE DEN HÄR MIGRATIONEN MEJLAS INTE
--
-- Raderna som redan står i Att göra när migrationen körs läggs in som
-- redan mejlade. Annars kommer allt som legat och väntat som ett enda
-- mejl en timme efter driftsättningen.
--
-- Intresseanmälan mejlas dessutom direkt av lead-notis, som förut. Det
-- mejlet är aviseringen; det här är påminnelsen om den ligger kvar.
--
--
-- ORDNING: edge-funktionen admin-paminnelse driftsätts FÖRE migrationen.
-- Jobbet är schemalagt här, och en funktion som saknas svarar 404 på
-- första mejlet. Det syns i notisfelen och raden försöks tre gånger.
-- ============================================================


-- ---------- 1. vart funktionen bor ----------
alter table public.notis_konfig add column if not exists admin_paminnelse_url text;

comment on column public.notis_konfig.admin_paminnelse_url is
  'Adressen till edge-funktionen admin-paminnelse. intern.admin_paminnelse_skicka() väcker den med pg_net '
  'och hemligheten i x-nextrum-notis. Null betyder att inga påminnelser skickas; raderna ligger då kvar som vantar.';

-- Härledd ur arbetarens adress, som ansokan_url: samma projekt, och ingen
-- projektreferens hårdkodad här.
update public.notis_konfig
   set admin_paminnelse_url = regexp_replace(arbetare_url, '/notis-ko/?$', '/admin-paminnelse')
 where id = 1 and admin_paminnelse_url is null and arbetare_url ~ '/notis-ko/?$';


-- ---------- 2. tabellerna ----------
create table if not exists public.admin_paminnelser (
  typ           text not null
                check (typ in ('ny_lead', 'ny_ansokan', 'sh_godkann', 'elev_utan_sh', 'fraga',
                               'pass_saknar_rapport', 'genomfort_utan_rapport', 'faktura_lagga_in',
                               'faktura_obetald', 'utbetalning', 'rapport_obekraftad', 'uppgift')),
  objekt_id     text not null,
  forst_sedd_at timestamptz not null default now(),
  mejlad_at     timestamptz,
  primary key (typ, objekt_id)
);

comment on table public.admin_paminnelser is
  'Det som står i Att göra just nu, och när det först syntes. Skrivs bara av intern.admin_paminnelse_koa(): '
  'en rad försvinner när saken lämnar listan. mejlad_at sätts när saken tagits med i ett mejl, en gång. '
  'Inga namn eller texter, bara typ och radens id.';

create table if not exists public.admin_paminnelse_utskick (
  id            uuid primary key default gen_random_uuid(),
  antal         jsonb not null check (jsonb_typeof(antal) = 'object'),
  status        text not null default 'vantar'
                check (status in ('vantar', 'skickar', 'skickad', 'fel')),
  forsok        integer not null default 0,
  lanad_till    timestamptz,
  fel           text,
  leverantor_id text,
  skapad        timestamptz not null default now(),
  uppdaterad    timestamptz not null default now()
);

comment on table public.admin_paminnelse_utskick is
  'Ett mejl till superadminarna: antal per sort sak som legat en timme i Att göra. Skrivs av '
  'intern.admin_paminnelse_koa(), skickas av admin-paminnelse. Ingen adress, inget namn, ingen text: '
  'mottagarna läses ur admin_roller när mejlet skrivs. Rader äldre än 90 dagar tas bort av samma jobb (intern.admin_paminnelse_stada()).';

create index if not exists admin_paminnelse_utskick_igen on public.admin_paminnelse_utskick (status, uppdaterad)
  where status in ('vantar', 'skickar', 'fel');

alter table public.admin_paminnelser enable row level security;
alter table public.admin_paminnelse_utskick enable row level security;
revoke all on public.admin_paminnelser from anon, authenticated;
revoke all on public.admin_paminnelse_utskick from anon, authenticated;
grant select on public.admin_paminnelser to authenticated;
grant select on public.admin_paminnelse_utskick to authenticated;

-- is_admin() är superadmin. En admin med behörigheter får ingenting härifrån.
-- En kontroll i stället för att ta bort och skapa om policyn: filen går att köra
-- en gång till, och ingen sats i den river något (verktyget som kör migrationer i
-- driften ber om en bekräftelse för varje sådan sats, och hänger sig om ingen svarar).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'admin_paminnelser' and policyname = 'admin läser påminnelserna') then
    create policy "admin läser påminnelserna" on public.admin_paminnelser
      for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'admin_paminnelse_utskick' and policyname = 'admin läser påminnelseutskicken') then
    create policy "admin läser påminnelseutskicken" on public.admin_paminnelse_utskick
      for select to authenticated using (public.is_admin());
  end if;
end $$;


-- ---------- 3. vad som står i Att göra ----------
-- Samma villkor som byggAttGöra i nextrum-admin-oversikt.js, rad för rad.
-- Ändras det ena ändras det andra.
create or replace function intern.admin_att_gora()
returns table (typ text, objekt_id text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'ny_lead'::text, l.id::text from public.leads l where l.status = 'new'
  union all
  select 'ny_ansokan', a.id::text from public.applications a where a.status = 'new'
  union all
  select 'sh_godkann', t.id::text from public.tutor_profiles t where t.status = 'pending'
  -- Elevens egen matchning, inte familjens, och inte ett avidentifierat barn.
  union all
  select 'elev_utan_sh', s.id::text from public.students s
   where s.raderad_at is null
     and (s.matched_tutor_id is null or s.match_status is distinct from 'matched')
  union all
  select 'fraga', m.id::text from public.contact_messages m where m.hanterad_at is null
  union all
  select 'pass_saknar_rapport', b.id::text from public.bookings b
   where b.status not in ('cancelled', 'completed')
     and b.wanted_date < (now() at time zone 'Europe/Stockholm')::date
  union all
  select 'genomfort_utan_rapport', p.id::text from public.passunderlag p
   where p.fakturerbar and not p.har_rapport and not p.fakturerad and not p.pa_underlag
  union all
  select 'faktura_lagga_in', i.id::text from public.invoices i where i.status = 'utkast'
  union all
  select 'faktura_obetald', i.id::text from public.invoices i where i.status in ('skickad', 'forfallen')
  union all
  select 'utbetalning', u.id::text from public.payouts u where u.status in ('utkast', 'godkand')
  -- Bara här: rapporten är skriven men familjen har inte bekräftat den.
  union all
  select 'rapport_obekraftad', r.id::text from public.lesson_reports r
    join public.students s on s.id = r.student_id and s.raderad_at is null
   where not exists (select 1 from public.rapport_bekraftelser b where b.rapport_id = r.id)
  -- Bara här: det systemet själv lagt (kontrollerna, månadskörningens svar).
  union all
  select 'uppgift', u.id::text from public.uppgifter u
   where u.status in ('oppen', 'pagar') and u.skapad_av_typ in ('system', 'ai')
$$;

revoke all on function intern.admin_att_gora() from public, anon, authenticated;


-- ---------- 4. väck funktionen ----------
create or replace function intern.admin_paminnelse_skicka(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k public.notis_konfig%rowtype;
begin
  select * into k from public.notis_konfig where id = 1;
  -- Utan adress eller hemlighet ligger raden kvar som 'vantar'. Att
  -- kasta här hade stoppat hela jobbet, och därmed räkningen av listan.
  if k.admin_paminnelse_url is null or k.hemlighet is null then
    return;
  end if;
  perform intern.natanrop(
    mal := 'admin-paminnelse',
    url := k.admin_paminnelse_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet),
    body := jsonb_build_object('id', p_id),
    timeout_milliseconds := 15000);
end $$;

revoke all on function intern.admin_paminnelse_skicka(uuid) from public, anon, authenticated;


-- ---------- 5. jobbet ----------
-- Rensningen av gamla utskick är en egen funktion, och jobbet nedan har därför
-- bara en delete. Verktyget som kör migrationer i driften ber om en bekräftelse
-- för en funktion med två, och hänger sig om ingen svarar.
create or replace function intern.admin_paminnelse_stada()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.admin_paminnelse_utskick where skapad < now() - interval '90 days';
end $$;

revoke all on function intern.admin_paminnelse_stada() from public, anon, authenticated;

-- Går var femte minut (pg_cron admin-paminnelse). Returnerar hur många
-- saker som gick med i ett nytt mejl.
create or replace function intern.admin_paminnelse_koa()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r      record;
  v_id   uuid;
  v_antal jsonb;
  v_n    integer;
begin
  -- 1. Listan nu: nytt in, det som gått ur bort. En enda sats, så att
  -- båda ser samma lista.
  with nu as materialized (
    select a.typ, a.objekt_id from intern.admin_att_gora() a
  ), ny as (
    insert into public.admin_paminnelser (typ, objekt_id)
    select nu.typ, nu.objekt_id from nu
    on conflict do nothing
  )
  delete from public.admin_paminnelser p
   where not exists (select 1 from nu where nu.typ = p.typ and nu.objekt_id = p.objekt_id);

  perform intern.admin_paminnelse_stada();

  -- 2. Ett mejl som inte gick fram prövas igen: samma regler som
  -- ansokan_besked_igen(). Högst tre försök, bara det senaste dygnet.
  for r in
    select u.id from public.admin_paminnelse_utskick u
     where u.skapad > now() - interval '24 hours'
       and u.forsok < 3
       and ((u.status = 'vantar' and u.skapad < now() - interval '2 minutes')
         or (u.status = 'fel' and u.uppdaterad < now() - make_interval(mins => 5 * greatest(u.forsok, 1)))
         or (u.status = 'skickar' and u.lanad_till < now()))
     order by u.skapad
     limit 5
  loop
    perform intern.admin_paminnelse_skicka(r.id);
  end loop;

  -- 3. Högst ett nytt mejl per kvart. Det som mognat under tiden går med
  -- i nästa.
  if exists (select 1 from public.admin_paminnelse_utskick where skapad > now() - interval '15 minutes') then
    return 0;
  end if;

  -- 4. Det som legat en timme och inte mejlats. Sätts och köas i samma
  -- transaktion, så en sak går aldrig med i två mejl.
  with mogna as (
    update public.admin_paminnelser
       set mejlad_at = now()
     where mejlad_at is null
       and forst_sedd_at <= now() - interval '1 hour'
    returning typ
  ), per_typ as (
    select typ, count(*) as n from mogna group by typ
  )
  select jsonb_object_agg(typ, n), sum(n)::integer into v_antal, v_n from per_typ;

  if v_n is null then
    return 0;
  end if;

  insert into public.admin_paminnelse_utskick (antal) values (v_antal) returning id into v_id;
  perform intern.admin_paminnelse_skicka(v_id);
  return v_n;
end $$;

revoke all on function intern.admin_paminnelse_koa() from public, anon, authenticated;


-- ---------- 6. funktionens två dörrar, bara för service_role ----------
-- Mottagarna: superadminarna med en adress. Adressen lämnar databasen
-- bara hit, till edge-funktionen, och står aldrig i en logg.
create or replace function public.admin_paminnelse_ta(p_id uuid)
returns table (id uuid, till text[], antal jsonb, forsok integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r      public.admin_paminnelse_utskick%rowtype;
  v_till text[];
begin
  update public.admin_paminnelse_utskick u
     set status = 'skickar', forsok = u.forsok + 1,
         lanad_till = now() + interval '2 minutes', uppdaterad = now()
   where u.id = p_id
     and u.forsok < 3
     and (u.status in ('vantar', 'fel') or (u.status = 'skickar' and u.lanad_till < now()))
  returning u.* into r;
  if not found then
    return;
  end if;

  select coalesce(array_agg(distinct lower(btrim(p.email))), '{}'::text[]) into v_till
    from public.admin_roller a
    join public.profiles p on p.id = a.user_id
   where a.ar_superadmin
     and p.raderad_at is null
     and coalesce(btrim(p.email), '') <> '';

  return query select r.id, v_till, r.antal, r.forsok;
end $$;

create or replace function public.admin_paminnelse_klar(
  p_id uuid, p_ok boolean, p_fel text, p_leverantor_id text, p_permanent boolean)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.admin_paminnelse_utskick
     set status = case when p_ok then 'skickad' else 'fel' end,
         fel = case when p_ok then null else left(p_fel, 300) end,
         leverantor_id = case when p_ok then left(p_leverantor_id, 100) else leverantor_id end,
         -- Ett fel som inte blir bättre av ett nytt försök (ingen mottagare,
         -- ogiltig adress) ska inte prövas två gånger till.
         forsok = case when p_permanent then 3 else forsok end,
         lanad_till = null, uppdaterad = now()
   where id = p_id;
$$;

revoke execute on function public.admin_paminnelse_ta(uuid) from public, anon, authenticated;
revoke execute on function public.admin_paminnelse_klar(uuid, boolean, text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_paminnelse_ta(uuid) to service_role;
grant execute on function public.admin_paminnelse_klar(uuid, boolean, text, text, boolean) to service_role;


-- ---------- 7. det som redan står i listan räknas som mejlat ----------
-- Se överst. Kör migrationen en gång till och raderna finns redan.
insert into public.admin_paminnelser (typ, objekt_id, mejlad_at)
select a.typ, a.objekt_id, now() from intern.admin_att_gora() a
on conflict do nothing;


-- ---------- 8. schemat ----------
-- Var femte minut, som ansokan-besked och timmar-betalar. En timme räknas
-- från första gången saken syntes, så mejlet kommer inom fem minuter
-- efter timmen.
select cron.unschedule(jobid) from cron.job where jobname = 'admin-paminnelse';
select cron.schedule('admin-paminnelse', '*/5 * * * *', $$select intern.admin_paminnelse_koa()$$);
