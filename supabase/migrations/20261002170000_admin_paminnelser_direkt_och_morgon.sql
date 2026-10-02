-- ============================================================
-- NEXTRUM — admin-mejlen rättas: direkt för en jobbansökan, morgonmejl för resten
-- (2026-10-02)
--
-- Förra migrationen (20261002120000_admin_paminnelser) byggde fel sak. Leo
-- bad om det här: "intresseanmälning och jobbansökan skickar en notis direkt
-- till alla i admin om att det har kommit in, bara en gång dock. Rapporter
-- och andra notiser såsom uteblivna rapporter ska skickas en notis genom
-- mail till admin mailen dagen efter kl 9." Jag läste det som ett mejl en
-- timme efter att en sak dök upp, för allt. Jobbet var i drift en kort stund
-- och pausades när felet påpekades; inget mejl till admin hann gå.
--
-- Så här är det nu:
--
--   · INTRESSEANMÄLAN: lead-notis mejlar redan direkt, en gång per anmälan,
--     till båda superadminarna och info@. Det är aviseringen, och den rörs
--     inte. Leads räknas därför inte med i morgonmejlet.
--   · JOBBANSÖKAN: en trigger på applications ger ett mejl direkt, en gång
--     per ansökan (slag 'direkt'). Mejlet bär ingen uppgift om vem som sökt:
--     det säger bara att något kommit in, och resten står bakom inloggningen.
--     Ansökan räknas därför inte heller med i morgonmejlet.
--   · ALLT ANNAT i Att göra (rapporter familjen inte bekräftat, pass utan
--     rapport, fakturor, utbetalningar, frågor, uppgifter ...) går i ETT mejl
--     kl. 9 svensk tid, för det som ligger kvar då och inte mejlats förut
--     (slag 'morgon'). Varje sak kommer med i ett morgonmejl en gång. Ett pass
--     som saknar rapport hamnar i Att göra vid midnatt efter passet, så det
--     kommer kl. 9 samma morgon: dagen efter passet.
--
-- Klockan 9 räknas i Europe/Stockholm, inte i UTC. pg_cron går i UTC, och 9
-- svensk tid är 07:00 UTC på sommaren och 08:00 på vintern. Jobbet går därför
-- fortfarande var femte minut, och funktionen tittar själv på svensk tid.
-- Bara timmen 9 räknas, inte "9 eller senare": en driftsättning mitt på
-- dagen ska inte skicka ett mejl på stående fot.
--
--
-- VEM FÅR DET
--
-- Superadminarna (admin_paminnelse_ta) och info@nextrum.se (edge-funktionen),
-- som aviseringen om en intresseanmälan. "Alla i admin" är i dag två personer,
-- båda superadmins. Att göra är bara superadminarnas vy (BARA_SUPER i
-- nextrum-admin-behorighet.js), så en admin med behörigheter får inte
-- morgonmejlet om det skulle dyka upp en sådan.
--
--
-- SOM FÖRUT: LISTAN STÅR PÅ TVÅ STÄLLEN
--
-- intern.admin_att_gora() speglar byggAttGöra i nextrum-admin-oversikt.js,
-- minus det som mejlas direkt (intresseanmälan, ansökan). Ändras listan i
-- vyn ändras funktionen i samma ändring, och tvärtom.
--
--
-- DET SOM STÅR I LISTAN NÄR MIGRATIONEN KÖRS
--
-- Förra migrationen la in det som redan stod i Att göra som "redan mejlat",
-- så att ingenting skulle komma som en översvämning en timme efter
-- driftsättningen. Det var för det gamla jobbet. Morgonmejlet är ett mejl om
-- dagen, och det som ligger och väntar är precis vad det finns till för: de
-- raderna (mejlad_at = forst_sedd_at, alltså lagda in utan att ha mejlats)
-- räknas nu som ännu inte mejlade och går med i första morgonmejlet.
-- En rad som hann mejlas på riktigt har mejlad_at efter forst_sedd_at och
-- rörs inte, och en tidsgräns i satsen gör att filen går att köra en gång
-- till utan att något mejlas om.
--
--
-- ORDNING: edge-funktionen admin-paminnelse (version 2) driftsätts FÖRE
-- migrationen. Den gamla förstår inte slag, och triggern här börjar mejla
-- direkt i samma stund som den skapas.
--
-- Inga satser här river något, och ingen funktion har mer än en delete:
-- verktyget som kör migrationer i driften ber om en bekräftelse för det, och
-- hänger sig om ingen svarar (minne/databasen.md).
-- ============================================================


-- ---------- 1. slaget på ett utskick ----------
alter table public.admin_paminnelse_utskick
  add column if not exists slag text not null default 'morgon'
  check (slag in ('direkt', 'morgon', 'prov'));

comment on column public.admin_paminnelse_utskick.slag is
  'direkt = en jobbansökan som just kommit in (trigger på applications). morgon = det som ligger kvar i Att göra kl. 9, '
  'ett mejl om dagen. prov = ett testmejl som en människa bett om, och som aldrig köas av jobbet. Mejlets text följer slaget.';

comment on table public.admin_paminnelse_utskick is
  'Ett mejl till admin: en ny jobbansökan direkt (slag direkt), eller det som ligger kvar i Att göra kl. 9 (slag morgon). '
  'Ingen adress, inget namn, ingen text: mottagarna läses ur admin_roller när mejlet skrivs. '
  'Rader äldre än 90 dagar tas bort av intern.admin_paminnelse_stada().';

comment on table public.admin_paminnelser is
  'Det som står i Att göra just nu (utom det som mejlas direkt), och när det först syntes. Skrivs bara av '
  'intern.admin_paminnelse_kor(): en rad försvinner när saken lämnar listan. mejlad_at sätts när saken tagits med i '
  'morgonmejlet, en gång. Inga namn eller texter, bara typ och radens id.';

-- Ett morgonmejl per svensk dag, också om jobbet skulle köra två gånger på en gång.
-- Det som inte hinner in i indexet kastas av databasen och rullar tillbaka hela körningen,
-- inklusive markeringen mejlad_at, så ingen sak går förlorad.
create unique index if not exists admin_paminnelse_utskick_ett_morgonmejl_per_dag
  on public.admin_paminnelse_utskick (((skapad at time zone 'Europe/Stockholm')::date))
  where slag = 'morgon';


-- ---------- 2. vad som står i Att göra, utom det som mejlas direkt ----------
create or replace function intern.admin_att_gora()
returns table (typ text, objekt_id text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Ingen intresseanmälan (lead-notis mejlar den direkt) och ingen jobbansökan
  -- (triggern admin_ansokan_direkt mejlar den direkt): båda finns i Att göra i
  -- vyn, men ska inte komma en gång till i morgonmejlet.
  select 'sh_godkann'::text, t.id::text from public.tutor_profiles t where t.status = 'pending'
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


-- ---------- 3. jobbet: räkna listan, pröva om, och kl. 9 skriv morgonmejlet ----------
-- Tiden kommer in som argument så att kl. 9, sommartid och vintertid går att
-- prova utan att vänta på dem. Jobbet anropar intern.admin_paminnelse_koa(),
-- som bara skickar in klockan.
create or replace function intern.admin_paminnelse_kor(p_nu timestamptz)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r       record;
  v_id    uuid;
  v_antal jsonb;
  v_n     integer;
  v_idag  date := (p_nu at time zone 'Europe/Stockholm')::date;
begin
  -- 1. Listan nu: nytt in, det som gått ur bort. En enda sats, så att
  -- båda ser samma lista. Raden minns när saken först syntes.
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

  -- 2. Ett mejl som inte gick fram prövas igen, direkta som morgonmejl:
  -- samma regler som ansokan_besked_igen(). Högst tre försök, bara det senaste dygnet.
  for r in
    select u.id from public.admin_paminnelse_utskick u
     where u.skapad > now() - interval '24 hours'
       and u.slag <> 'prov'
       and u.forsok < 3
       and ((u.status = 'vantar' and u.skapad < now() - interval '2 minutes')
         or (u.status = 'fel' and u.uppdaterad < now() - make_interval(mins => 5 * greatest(u.forsok, 1)))
         or (u.status = 'skickar' and u.lanad_till < now()))
     order by u.skapad
     limit 5
  loop
    perform intern.admin_paminnelse_skicka(r.id);
  end loop;

  -- 3. Morgonmejlet skrivs bara under timmen kl. 9 svensk tid, och bara en gång
  -- per dag. Före 9 och efter 10 går inget; det som uteblev i dag går i morgon.
  if extract(hour from p_nu at time zone 'Europe/Stockholm') <> 9 then
    return 0;
  end if;
  if exists (select 1 from public.admin_paminnelse_utskick u
              where u.slag = 'morgon' and (u.skapad at time zone 'Europe/Stockholm')::date = v_idag) then
    return 0;
  end if;

  -- 4. Allt som står i listan och inte mejlats. Markeras och köas i samma
  -- transaktion, så en sak aldrig går med i två mejl.
  with mogna as (
    update public.admin_paminnelser
       set mejlad_at = now()
     where mejlad_at is null
    returning typ
  ), per_typ as (
    select typ, count(*) as n from mogna group by typ
  )
  select jsonb_object_agg(typ, n), sum(n)::integer into v_antal, v_n from per_typ;

  if v_n is null then
    return 0;
  end if;

  insert into public.admin_paminnelse_utskick (antal, slag, skapad) values (v_antal, 'morgon', p_nu)
  returning id into v_id;
  perform intern.admin_paminnelse_skicka(v_id);
  return v_n;
end $$;

revoke all on function intern.admin_paminnelse_kor(timestamptz) from public, anon, authenticated;

-- Jobbet (pg_cron admin-paminnelse, var femte minut). Samma signatur som förut.
create or replace function intern.admin_paminnelse_koa()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  select intern.admin_paminnelse_kor(now())
$$;

revoke all on function intern.admin_paminnelse_koa() from public, anon, authenticated;


-- ---------- 4. en jobbansökan mejlas direkt ----------
-- Ett fel här får aldrig stoppa ansökan. Ett uteblivet mejl är ett mindre fel
-- än en ansökan som inte sparas, och raden som inte gick iväg prövas igen av
-- jobbet. Mejlet bär ingenting ur ansökan, så triggern läser ingenting ur raden.
--
-- Bromsen: en ansökan kan skickas av vem som helst. Fler än fem direktmejl på tio
-- minuter betyder att något annat än jobbsökande håller på, och då fyller vi inte
-- inkorgen. Ansökningarna syns ändå i Att göra i vyn.
create or replace function intern.admin_ansokan_direkt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id   uuid;
  v_flod integer;
begin
  begin
    select count(*) into v_flod from public.admin_paminnelse_utskick u
     where u.slag = 'direkt' and u.skapad > now() - interval '10 minutes';
    if v_flod >= 5 then
      raise warning 'admin_ansokan_direkt: fem direktmejl på tio minuter, den här ansökan mejlas inte.';
      return new;
    end if;
    insert into public.admin_paminnelse_utskick (antal, slag)
    values (jsonb_build_object('ny_ansokan', 1), 'direkt')
    returning id into v_id;
    perform intern.admin_paminnelse_skicka(v_id);
  exception when others then
    raise warning 'admin_ansokan_direkt: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end $$;

revoke all on function intern.admin_ansokan_direkt() from public, anon, authenticated;

-- En kontroll i stället för att ta bort och skapa om triggern: filen går att köra en
-- gång till, och ingen sats i den river något.
do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'admin_ansokan_direkt' and tgrelid = 'public.applications'::regclass
                    and not tgisinternal) then
    create trigger admin_ansokan_direkt
      after insert on public.applications
      for each row execute function intern.admin_ansokan_direkt();
  end if;
end $$;


-- ---------- 5. funktionens dörr: slaget följer med ----------
-- Samma signatur som förut (en funktion med ett annat returvärde går inte att byta
-- utan att ta bort den först), så slaget går med i antal-objektet. Edge-funktionen
-- läser det därifrån, och adminRader() hoppar över nyckeln som en okänd sort.
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

  return query select r.id, v_till, r.antal || jsonb_build_object('slag', r.slag), r.forsok;
end $$;

revoke execute on function public.admin_paminnelse_ta(uuid) from public, anon, authenticated;
grant execute on function public.admin_paminnelse_ta(uuid) to service_role;


-- ---------- 6. det som lagts in utan att mejlas räknas som ännu inte mejlat ----------
-- Se överst. Förra migrationen la in raderna i en enda transaktion, kl. 16:19 UTC, så
-- de har exakt samma tid i båda kolumnerna. Gränsen kl. 16:20 UTC gör att inget som
-- mejlas senare, i samma körning som det syntes, kan tas för en sådan rad om filen
-- körs en gång till.
update public.admin_paminnelser set mejlad_at = null
 where mejlad_at = forst_sedd_at and forst_sedd_at < timestamptz '2026-10-02 16:20:00+00';


-- ---------- 7. schemat ----------
-- Jobbet pausades när det gamla beteendet visade sig vara fel. Det går igen nu,
-- var femte minut som förut: kl. 9 avgörs i funktionen, inte i schemat.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'admin-paminnelse') then
    perform cron.alter_job(job_id := (select jobid from cron.job where jobname = 'admin-paminnelse'),
                           active := true);
  else
    perform cron.schedule('admin-paminnelse', '*/5 * * * *', $cmd$select intern.admin_paminnelse_koa()$cmd$);
  end if;
end $$;
