-- ============================================================
-- Barnets egen e-post (barnets_epost, 2026-10-01)
--
-- Leo: föräldern ska kunna lägga till en e-post för sitt barn, och
-- barnet ska kunna logga in med den i sin vy och få notiser dit. Valt:
-- inloggning och mejlnotiser, föräldern styr lösenordet, och Auth mejlar
-- aldrig ett barn.
--
-- VAD SOM ÄNDRAS, OCH VAD SOM INTE GÖR DET
--
-- Barnkontot i Auth är detsamma: den tekniska adressen
-- <namn>@barn.nextrum.se, som aldrig tar emot mejl, och alla spärrar i
-- intern.auth_barnkonto_las står kvar. Barnets riktiga adress ligger i
-- en egen tabell, barn_epost, och når aldrig auth.users. Därför kan Auth
-- inte skicka något till den, och en adress som redan har ett eget konto
-- krockar inte med barnets.
--
-- barn_epost har inga rättigheter alls för inloggade: studiehjälparen,
-- som läser students för sina elever, ser aldrig adressen. Föräldern,
-- barnet och inloggningsfunktionen når den genom funktionerna nedan.
--
-- BEKRÄFTELSEN. Föräldern skriver adressen; den används till ingenting
-- förrän någon med tillgång till inkorgen tryckt på knappen i mejlet.
-- En felskriven adress får alltså bara bekräftelsen, och den nämner inget
-- namn. Länkens kod är en HMAC över barnet, adressen och en omgång, med
-- notis_konfig.barn_nyckel: den sparas ingenstans, räknas fram när mejlet
-- skickas och prövas när den kommer tillbaka. Ny adress eller Skicka igen
-- ger en ny omgång, och då slutar den förra länken att gälla. En kod
-- gäller i sju dagar, och en adress som aldrig bekräftats gallras efter
-- 30 (intern.barnkonton_gallra).
--
-- INLOGGNINGEN. Auth loggar bara in med kontots egen adress, så edge-
-- funktionen barn-inloggning slår upp barnets tekniska adress här
-- (barn_inloggning_uppslag, bara service_role) och loggar in med den hos
-- Auth. Varje försök räknas, per adress och per IP-nummer, båda som en
-- HMAC och aldrig i klartext; tio fel på en adress eller tjugo från
-- ett nummer på en kvart, och sedan nekas det en stund. Auth ser bara
-- edge-funktionens nummer och har en gemensam kvot för det; taket per
-- nummer här gör att en ensam angripare inte kan tömma den.
--
-- MEJLEN. Barnets mejl går genom samma kö som familjens
-- (notis_utskick, med barn_id i stället för mottagare), och
-- notis_utskick_ta prövar allt igen när det är dags: flaggan, att
-- adressen är bekräftad, förälderns val, barnets egna val, att
-- inloggningen är aktiv och att passet fortfarande är bokat. Tre sorter:
-- bokat pass, avbokat pass och påminnelse före ett pass. Bekräftelsen är
-- den fjärde och går inte att välja bort, den är svaret på något
-- föräldern just gjort.
--
-- FLAGGAN barn_epost STÅR AV tills juristen läst policyn, registret och
-- konsekvensbedömningen (DEPLOY-BARNKONTON.md). Av betyder: rutan syns
-- inte, inloggningen nekas, inga mejl går till barn. Att ta bort en
-- adress och stänga av mejlen fungerar alltid.
--
-- Lapparna prövar sina träffar (CLAUDE.md avsnitt 5) och går att köra
-- två gånger.
-- ============================================================

insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa)
values ('barn_epost', false,
  'Barnets egen e-post. Föräldern lägger till barnets adress i studievyn, barnet bekräftar den med en länk, '
  || 'och sedan kan barnet logga in med den och få mejl om sina pass när föräldern slagit på det. '
  || 'Av: rutan syns inte, inloggningen med barnets e-post nekas och inga mejl går till barn. '
  || 'Adresser som redan finns ligger kvar och går att ta bort.',
  'Juristen ska ha läst integritetspolicyn på båda språken, registret och konsekvensbedömningen för barnets '
  || 'e-post (DEPLOY-BARNKONTON.md). barn-inloggning och notis-ko ska vara driftsatta från main, och ett mejl '
  || 'till ett barn ska ha gått till sandlådan.')
on conflict (kod) do nothing;

-- Nyckeln till bekräftelselänken och till försöksräknarens HMAC. En
-- egen, så att avregistreringsnyckeln bara gör det den heter.
alter table public.notis_konfig
  add column if not exists barn_nyckel text not null default encode(extensions.gen_random_bytes(32), 'base64');

-- ------------------------------------------------------------
-- Sorterna barnet kan få mejl om. Står också i typer.ts
-- (BARN_MEJLTYPER); ändras de, ändras båda.
-- ------------------------------------------------------------
create or replace function intern.barn_mejltyper()
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select array['barn_pass_bokat', 'barn_pass_avbokat', 'barn_paminnelse']
$$;

create sequence if not exists intern.barn_epost_omgang;

-- ------------------------------------------------------------
-- Tabellen
-- ------------------------------------------------------------
create table if not exists public.barn_epost (
  barn_id     uuid primary key references public.students(id) on delete cascade,
  epost       text not null,
  bekraftad   timestamptz,
  kod_omgang  bigint not null,
  kod_skapad  timestamptz not null default now(),
  notiser     boolean not null default false,
  av          text[] not null default '{}',
  skapad      timestamptz not null default now(),
  uppdaterad  timestamptz not null default now(),
  constraint barn_epost_form check (
    char_length(epost) between 6 and 254
    and epost = lower(btrim(epost))
    and epost ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
    and epost !~ '@barn\.nextrum\.se$'),
  constraint barn_epost_av check (av <@ intern.barn_mejltyper())
);

comment on table public.barn_epost is
  'Barnets egen e-post (barnets_epost). Ingen inloggad når tabellen; föräldern, barnet och barn-inloggning går genom funktioner. notiser är förälderns val, av är barnets egna avstängda sorter.';

-- En bekräftad adress hör till ett barn. Obekräftade får krocka: den
-- som äger inkorgen avgör, och bara en av dem går att bekräfta.
create unique index if not exists barn_epost_bekraftad_unik on public.barn_epost (epost) where bekraftad is not null;

alter table public.barn_epost enable row level security;
revoke all on public.barn_epost from public, anon, authenticated;

-- Försöken att logga in med en barnadress. Bara HMAC:ar, aldrig adressen
-- eller IP-numret, och inget äldre än ett dygn.
create table if not exists intern.barn_inloggning_forsok (
  id     bigint generated always as identity primary key,
  nyckel text not null,
  tid    timestamptz not null default now()
);
create index if not exists barn_inloggning_forsok_nyckel on intern.barn_inloggning_forsok (nyckel, tid);
create index if not exists barn_inloggning_forsok_tid on intern.barn_inloggning_forsok (tid);
alter table intern.barn_inloggning_forsok enable row level security;
revoke all on intern.barn_inloggning_forsok from public, anon, authenticated;

-- ------------------------------------------------------------
-- Kön: en rad går antingen till ett konto (mottagare) eller till ett
-- barn (barn_id). Raderna om barnet går med barnet.
-- ------------------------------------------------------------
alter table public.notis_utskick alter column mottagare drop not null;
alter table public.notis_utskick add column if not exists barn_id uuid references public.students(id) on delete cascade;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notis_utskick_en_mottagare') then
    alter table public.notis_utskick
      add constraint notis_utskick_en_mottagare check ((mottagare is null) <> (barn_id is null));
  end if;
end $$;
create index if not exists notis_utskick_barn_idx on public.notis_utskick (barn_id) where barn_id is not null;

-- ------------------------------------------------------------
-- Hjälpfunktionerna
-- ------------------------------------------------------------

-- Länkens kod: barnets id och en HMAC över id, adress och omgång.
create or replace function intern.barn_epost_kod(p_barn uuid, p_epost text, p_omgang bigint)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_barn::text || '.'
         || translate(rtrim(encode(extensions.hmac(
              convert_to('barn-epost:v1:' || p_barn::text || ':' || p_epost || ':' || p_omgang::text, 'UTF8'),
              decode(k.barn_nyckel, 'base64'), 'sha256'), 'base64'), '='), '+/', '-_')
    from public.notis_konfig k
   where k.id = 1
$$;

-- Vill barnet ha den här sorten, just nu? Flaggan, en bekräftad adress,
-- förälderns val, barnets eget och en aktiv inloggning.
create or replace function intern.barn_vill_mejl(p_barn uuid, p_typ text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.flagga_pa('barn_epost')
     and coalesce(p_typ = any (intern.barn_mejltyper()), false)
     and exists (select 1
                   from public.barn_epost e
                   join public.students s on s.id = e.barn_id
                  where e.barn_id = p_barn and e.bekraftad is not null and e.notiser
                    and not (p_typ = any (e.av))
                    and s.user_id is not null and s.barn_aktiv and s.raderad_at is null)
$$;

-- Köar ett mejl till barnet. Samma samlingsregel som intern.notis_koa.
create or replace function intern.barn_mejl_koa(p_barn uuid, p_typ text, p_pass uuid, p_data jsonb,
                                                p_samlingsnyckel text, p_idempotens text,
                                                p_skicka_efter timestamptz, p_skicka_senast timestamptz)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_samlingsnyckel is not null then
    insert into public.notis_utskick as u
      (barn_id, kanal, typ, pass_id, data, samlingsnyckel, idempotens, skicka_efter, skicka_senast)
    values (p_barn, 'mejl', p_typ, p_pass, coalesce(p_data, '{}'::jsonb), p_samlingsnyckel, p_idempotens,
            p_skicka_efter, p_skicka_senast)
    on conflict (samlingsnyckel) where status = 'vantar' and samlingsnyckel is not null
    do update set antal = u.antal + 1, typ = excluded.typ, data = u.data || excluded.data, uppdaterad = now();
  else
    insert into public.notis_utskick
      (barn_id, kanal, typ, pass_id, data, idempotens, skicka_efter, skicka_senast)
    values (p_barn, 'mejl', p_typ, p_pass, coalesce(p_data, '{}'::jsonb), p_idempotens, p_skicka_efter, p_skicka_senast)
    on conflict (idempotens) do nothing;
  end if;
end $$;

-- Ett bokat eller avbokat pass, från intern.barnnotis_vid_pass. Ett fel
-- här får aldrig ta notisen i barnets vy med sig, och aldrig passet.
create or replace function intern.barn_passmejl_koa(p_barn uuid, p_pass uuid, p_vad text, p_datum date,
                                                    p_tid text, p_amne text, p_tutor uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  typ  text := case p_vad when 'bekraftat' then 'barn_pass_bokat' when 'avbokat' then 'barn_pass_avbokat' end;
  inst public.notis_installning%rowtype;
begin
  if typ is null or not intern.barn_vill_mejl(p_barn, typ) then
    return;
  end if;
  select * into inst from public.notis_installning where id = 1;
  perform intern.barn_mejl_koa(p_barn, typ, p_pass,
    jsonb_strip_nulls(jsonb_build_object(
      'datum', p_datum, 'tid', left(coalesce(p_tid, ''), 5), 'amne', intern.fornamn(p_amne),
      'studiehjalpare', (select intern.fornamn(p.full_name) from public.profiles p where p.id = p_tutor))),
    'barnpass:' || p_barn || ':' || p_pass,
    typ || ':' || p_barn || ':' || p_pass || ':' || gen_random_uuid(),
    now() + make_interval(mins => coalesce(inst.pass_samla_minuter, 3)), null);
exception when others then
  insert into public.notis_fel (kalla, fel)
  values ('barn_passmejl_koa ' || coalesce(p_pass::text, ''), left(sqlerrm, 500));
end $$;

-- Påminnelsen före ett pass, från notis_planera, på samma tider som
-- familjens. Samma regel: ett fel stoppar aldrig familjens påminnelse.
create or replace function intern.barn_paminnelse_koa(p_pass uuid, p_barn uuid, p_datum date, p_tid text,
                                                      p_amne text, p_hjalp text, p_timmar integer,
                                                      p_start timestamptz)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_barn is null or not intern.barn_vill_mejl(p_barn, 'barn_paminnelse') then
    return;
  end if;
  perform intern.barn_mejl_koa(p_barn, 'barn_paminnelse', p_pass,
    jsonb_strip_nulls(jsonb_build_object(
      'datum', p_datum, 'tid', left(coalesce(p_tid, ''), 5), 'amne', intern.fornamn(p_amne),
      'studiehjalpare', p_hjalp, 'timmar', p_timmar, 'start', p_start)),
    null,
    'barnpaminnelse:' || p_barn || ':' || p_pass || ':' || p_timmar || ':' || extract(epoch from p_start)::bigint,
    now(), p_start);
exception when others then
  insert into public.notis_fel (kalla, fel)
  values ('barn_paminnelse_koa ' || coalesce(p_pass::text, ''), left(sqlerrm, 500));
end $$;

-- Bekräftelsemejlet. En samlingsnyckel per barn: trycker föräldern två
-- gånger innan kön hunnit skicka går ett mejl, med den senaste koden.
create or replace function intern.barn_epost_koa_bekraftelse(p_barn uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform intern.barn_mejl_koa(p_barn, 'barn_bekrafta_epost', null,
    jsonb_build_object('omgang', (select e.kod_omgang from public.barn_epost e where e.barn_id = p_barn)),
    'barnepost:' || p_barn,
    'barnepost:' || p_barn || ':' || gen_random_uuid(),
    now(), now() + interval '1 day');
end $$;

-- Taket för bekräftelsemejl: ett i minuten och fem om dygnet per barn,
-- räknat på kön, så att det inte nollställs av att adressen tas bort och
-- läggs till igen. Det är föräldern som skickar, men adressen kan vara
-- vem som helst.
create or replace function intern.barn_epost_tak(p_barn uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  senast timestamptz;
  antal  bigint;
begin
  select max(q.skapad), count(*) into senast, antal
    from public.notis_utskick q
   where q.barn_id = p_barn and q.typ = 'barn_bekrafta_epost' and q.skapad > now() - interval '1 day';
  if senast > now() - interval '1 minute' then
    raise exception using errcode = 'P0001', message = 'Vänta en minut innan du skickar ett nytt bekräftelsemejl.';
  end if;
  if antal >= 5 then
    raise exception using errcode = 'P0001',
      message = 'Det har gått fem bekräftelsemejl till barnet det senaste dygnet. Försök igen i morgon.';
  end if;
end $$;

-- Är den inloggade barnets förälder? p_andra: lägga till, skicka och slå
-- på kräver flaggan och barnets inloggning. Ta bort och slå av gör det
-- inte: det ska alltid gå.
create or replace function intern.barn_epost_forald(p_barn uuid, p_andra boolean)
returns public.students
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.students%rowtype;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'roll', '') = 'barn' then
    raise exception using errcode = '42501', message = 'Bara barnets förälder ändrar barnets e-post.';
  end if;
  select * into s from public.students where id = p_barn for update;
  if not found or s.parent_id is distinct from auth.uid() or s.raderad_at is not null then
    raise exception using errcode = '42501', message = 'Bara barnets förälder ändrar barnets e-post.';
  end if;
  if p_andra and not public.flagga_pa('barn_epost') then
    raise exception using errcode = '55000', message = 'Barnets e-post går inte att använda än.';
  end if;
  if p_andra and s.user_id is null then
    raise exception using errcode = '55000', message = 'Skapa barnets inloggning först. E-posten hör till den.';
  end if;
  return s;
end $$;

-- Läget för en förälder: adressen, om den är bekräftad, förälderns val
-- och när länken skickades. null när barnet inte har någon.
create or replace function intern.barn_epost_lage(p_barn uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'barn_id', e.barn_id,
           'epost', e.epost,
           'bekraftad', e.bekraftad,
           'notiser', e.notiser,
           'skickad', e.kod_skapad,
           'gammal', e.bekraftad is null and e.kod_skapad < now() - interval '7 days')
    from public.barn_epost e
   where e.barn_id = p_barn
$$;

revoke all on function intern.barn_epost_kod(uuid, text, bigint) from public, anon, authenticated;
revoke all on function intern.barn_vill_mejl(uuid, text) from public, anon, authenticated;
revoke all on function intern.barn_mejl_koa(uuid, text, uuid, jsonb, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function intern.barn_passmejl_koa(uuid, uuid, text, date, text, text, uuid) from public, anon, authenticated;
revoke all on function intern.barn_paminnelse_koa(uuid, uuid, date, text, text, text, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function intern.barn_epost_koa_bekraftelse(uuid) from public, anon, authenticated;
revoke all on function intern.barn_epost_tak(uuid) from public, anon, authenticated;
revoke all on function intern.barn_epost_forald(uuid, boolean) from public, anon, authenticated;
revoke all on function intern.barn_epost_lage(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Förälderns funktioner
-- ------------------------------------------------------------

-- Flaggan och adresserna för den inloggades barn med inloggning.
create or replace function public.mina_barns_epost()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'pa', public.flagga_pa('barn_epost'),
           'barn', coalesce((
             select jsonb_agg(coalesce(intern.barn_epost_lage(s.id), jsonb_build_object('barn_id', s.id))
                              order by s.created_at)
               from public.students s
              where s.parent_id = auth.uid() and s.raderad_at is null and s.user_id is not null), '[]'::jsonb))
   where coalesce(auth.jwt() -> 'app_metadata' ->> 'roll', '') <> 'barn'
$$;

-- Lägger till eller byter barnets adress och skickar bekräftelsen.
create or replace function public.barn_epost_satt(p_barn uuid, p_epost text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e   public.barn_epost%rowtype;
  har boolean;
  ny  text := lower(btrim(coalesce(p_epost, '')));
begin
  perform intern.barn_epost_forald(p_barn, true);

  if char_length(ny) not between 6 and 254 or ny !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception using errcode = '22023', message = 'Det ser inte ut som en e-postadress.';
  end if;
  if ny ~ '@barn\.nextrum\.se$' then
    raise exception using errcode = '22023',
      message = 'Adresser på barn.nextrum.se är barnkontonas tekniska och tar inte emot mejl.';
  end if;
  if exists (select 1 from auth.users u where u.id = auth.uid() and lower(u.email) = ny) then
    raise exception using errcode = '22023', message = 'Det är din egen adress. Barnets e-post ska vara barnets egen.';
  end if;

  -- FOUND sparas: varje PERFORM nedan skriver över det.
  select * into e from public.barn_epost where barn_id = p_barn for update;
  har := found;
  if har and e.epost = ny then
    -- Samma adress: bekräftad är klart, obekräftad är Skicka igen.
    if e.bekraftad is not null then
      return intern.barn_epost_lage(p_barn);
    end if;
    return public.barn_epost_skicka_igen(p_barn);
  end if;

  perform intern.barn_epost_tak(p_barn);
  if har then
    update public.notis_utskick q set status = 'hoppad', fel = 'adressen byttes', uppdaterad = now()
     where q.barn_id = p_barn and q.status = 'vantar';
    update public.barn_epost
       set epost = ny, bekraftad = null, kod_omgang = nextval('intern.barn_epost_omgang'),
           kod_skapad = now(), uppdaterad = now()
     where barn_id = p_barn;
  else
    insert into public.barn_epost (barn_id, epost, kod_omgang)
    values (p_barn, ny, nextval('intern.barn_epost_omgang'));
  end if;
  perform intern.barn_epost_koa_bekraftelse(p_barn);

  -- Händelsen, aldrig adressen.
  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
  values (auth.uid(), 'anvandare', 'barnepost.tillagd', 'barn_epost', p_barn::text,
          jsonb_build_object('bekraftad', false));
  return intern.barn_epost_lage(p_barn);
end $$;

-- En ny länk till samma adress. Den förra slutar gälla.
create or replace function public.barn_epost_skicka_igen(p_barn uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.barn_epost%rowtype;
begin
  perform intern.barn_epost_forald(p_barn, true);
  select * into e from public.barn_epost where barn_id = p_barn for update;
  if not found then
    raise exception using errcode = '55000', message = 'Barnet har ingen e-post att bekräfta.';
  end if;
  if e.bekraftad is not null then
    return intern.barn_epost_lage(p_barn);
  end if;
  perform intern.barn_epost_tak(p_barn);
  update public.barn_epost
     set kod_omgang = nextval('intern.barn_epost_omgang'), kod_skapad = now(), uppdaterad = now()
   where barn_id = p_barn;
  perform intern.barn_epost_koa_bekraftelse(p_barn);
  return intern.barn_epost_lage(p_barn);
end $$;

-- Tar bort adressen. Går alltid, också med flaggan av.
create or replace function public.barn_epost_ta_bort(p_barn uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform intern.barn_epost_forald(p_barn, false);
  -- Det som väntar går inte. Raderna står kvar, så att taket för
  -- bekräftelser inte nollställs av att adressen tas bort och läggs till.
  update public.notis_utskick q set status = 'hoppad', fel = 'adressen togs bort', uppdaterad = now()
   where q.barn_id = p_barn and q.status = 'vantar';
  delete from public.barn_epost where barn_id = p_barn;
  if found then
    insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id)
    values (auth.uid(), 'anvandare', 'barnepost.borttagen', 'barn_epost', p_barn::text);
  end if;
  return null;
end $$;

-- Förälderns val: går barnets notiser till adressen? Att slå av går
-- alltid; att slå på kräver flaggan.
create or replace function public.barn_epost_notiser(p_barn uuid, p_pa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pa boolean := coalesce(p_pa, false);
begin
  perform intern.barn_epost_forald(p_barn, pa);
  if not exists (select 1 from public.barn_epost where barn_id = p_barn) then
    raise exception using errcode = '55000', message = 'Lägg till barnets e-post först.';
  end if;
  update public.barn_epost set notiser = pa, uppdaterad = now()
   where barn_id = p_barn and notiser is distinct from pa;
  if found then
    insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
    values (auth.uid(), 'anvandare', 'barnepost.notiser', 'barn_epost', p_barn::text,
            jsonb_build_object('notiser', pa));
  end if;
  return intern.barn_epost_lage(p_barn);
end $$;

revoke all on function public.mina_barns_epost() from public, anon;
revoke all on function public.barn_epost_satt(uuid, text) from public, anon;
revoke all on function public.barn_epost_skicka_igen(uuid) from public, anon;
revoke all on function public.barn_epost_ta_bort(uuid) from public, anon;
revoke all on function public.barn_epost_notiser(uuid, boolean) from public, anon;
grant execute on function public.mina_barns_epost() to authenticated;
grant execute on function public.barn_epost_satt(uuid, text) to authenticated;
grant execute on function public.barn_epost_skicka_igen(uuid) to authenticated;
grant execute on function public.barn_epost_ta_bort(uuid) to authenticated;
grant execute on function public.barn_epost_notiser(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- Bekräftelsen, från knappen på nextrum.se/barn?bekrafta=. Utan
-- inloggning: den som har inkorgen har koden. Svarar med ett ord.
-- ------------------------------------------------------------
create or replace function public.barn_epost_bekrafta(p_kod text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  barn uuid := intern.uuid_eller_null(split_part(coalesce(p_kod, ''), '.', 1));
  e    public.barn_epost%rowtype;
  s    public.students%rowtype;
begin
  if barn is null or char_length(p_kod) > 200 then
    return 'ogiltig';
  end if;
  select * into e from public.barn_epost where barn_id = barn for update;
  -- Hasharna jämförs, inte koderna: en jämförelse som slutar vid första
  -- olika tecknet säger annars hur mycket av en gissning som stämde.
  if not found or extensions.digest(coalesce(intern.barn_epost_kod(e.barn_id, e.epost, e.kod_omgang), ''), 'sha256')
                  <> extensions.digest(p_kod, 'sha256') then
    return 'ogiltig';
  end if;
  if not public.flagga_pa('barn_epost') then
    return 'av';
  end if;
  if e.bekraftad is not null then
    return 'redan';
  end if;
  if e.kod_skapad < now() - interval '7 days' then
    return 'gammal';
  end if;
  select * into s from public.students where id = e.barn_id;
  if s.user_id is null or s.raderad_at is not null then
    return 'ogiltig';
  end if;
  begin
    update public.barn_epost set bekraftad = now(), uppdaterad = now() where barn_id = e.barn_id;
  exception when unique_violation then
    return 'upptagen';
  end;
  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
  values (null, 'system', 'barnepost.bekraftad', 'barn_epost', e.barn_id::text,
          jsonb_build_object('bekraftad', true));
  return 'ok';
end $$;

revoke all on function public.barn_epost_bekrafta(text) from public;
grant execute on function public.barn_epost_bekrafta(text) to anon, authenticated, nextrum_barn;

-- ------------------------------------------------------------
-- Barnets egna: inställningarna och valen
-- ------------------------------------------------------------
create or replace function public.barn_installningar()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  b  public.students%rowtype;
  e  public.barn_epost%rowtype;
  pa boolean := public.flagga_pa('barn_epost');
begin
  b := intern.mitt_barn();
  if b.id is null then
    return jsonb_build_object('lage', 'saknas');
  end if;
  if not b.barn_aktiv then
    return jsonb_build_object('lage', 'pausad');
  end if;
  select * into e from public.barn_epost where barn_id = b.id;
  return jsonb_build_object(
    'lage', 'ok',
    'fornamn', intern.fornamn(b.name),
    'anvandarnamn', b.anvandarnamn,
    'pa', pa,
    'epost', case when pa then e.epost end,
    'bekraftad', case when pa then e.bekraftad end,
    'notiser', pa and coalesce(e.notiser, false),
    'typer', (select jsonb_agg(jsonb_build_object('typ', x.t, 'pa', not (x.t = any (coalesce(e.av, '{}'::text[]))))
                               order by x.ord)
                from unnest(intern.barn_mejltyper()) with ordinality as x(t, ord)));
end $$;

-- Barnet stänger av eller slår på en sort, eller alla ('alla'). Det
-- förälderns val tillåter, inte mer: valet sparas, men går inte ut
-- förrän föräldern slagit på mejlen.
create or replace function public.barn_notisval(p_typ text, p_pa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  barn  uuid := (select b.id from intern.mitt_barn() b where b.barn_aktiv);
  typer text[];
begin
  if barn is null then
    raise exception using errcode = '42501', message = 'Logga in igen.';
  end if;
  if not public.flagga_pa('barn_epost') then
    raise exception using errcode = '55000', message = 'Mejlen från Nextrum är inte påslagna.';
  end if;
  if p_typ = 'alla' then
    typer := intern.barn_mejltyper();
  elsif p_typ = any (intern.barn_mejltyper()) then
    typer := array[p_typ];
  else
    raise exception using errcode = '22023', message = 'Okänd sorts mejl.';
  end if;
  update public.barn_epost e
     set av = case when coalesce(p_pa, false)
                   then array(select x from unnest(e.av) x where not (x = any (typer)) order by x)
                   else array(select distinct x from unnest(e.av || typer) x order by x) end,
         uppdaterad = now()
   where e.barn_id = barn;
  if not found then
    raise exception using errcode = '55000', message = 'Du har ingen e-post hos Nextrum.';
  end if;
  return public.barn_installningar();
end $$;

revoke all on function public.barn_installningar() from public, anon, authenticated;
revoke all on function public.barn_notisval(text, boolean) from public, anon, authenticated;
grant execute on function public.barn_installningar() to nextrum_barn;
grant execute on function public.barn_notisval(text, boolean) to nextrum_barn;

-- ------------------------------------------------------------
-- För barn-inloggning (service_role): uppslaget och utfallet.
--
-- Varje försök räknas innan adressen slås upp, också för en adress som
-- inte finns, så att svaret inte skiljer dem åt. Samma adress tas i tur
-- och ordning (låset), så att tio samtidiga försök inte blir tio
-- genomsläppta. Det som sparas är 'e:' eller 'i:' och en HMAC med
-- notis_konfig.barn_nyckel.
-- ------------------------------------------------------------
create or replace function public.barn_inloggning_uppslag(p_epost text, p_ip text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  nyckel bytea;
  ny     text := lower(btrim(coalesce(p_epost, '')));
  ek     text;
  ik     text;
  namn   text;
begin
  if not public.flagga_pa('barn_epost') then
    return jsonb_build_object('lage', 'av');
  end if;
  select decode(k.barn_nyckel, 'base64') into nyckel from public.notis_konfig k where k.id = 1;
  ek := 'e:' || encode(extensions.hmac(convert_to('barn-inloggning:epost:' || ny, 'UTF8'), nyckel, 'sha256'), 'hex');
  ik := 'i:' || encode(extensions.hmac(convert_to('barn-inloggning:ip:' || btrim(coalesce(p_ip, '')), 'UTF8'),
                                       nyckel, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(ek, 0));
  delete from intern.barn_inloggning_forsok f where f.tid < now() - interval '1 day';
  if (select count(*) from intern.barn_inloggning_forsok f
       where f.nyckel = ek and f.tid > now() - interval '15 minutes') >= 10
     or (select count(*) from intern.barn_inloggning_forsok f
          where f.nyckel = ik and f.tid > now() - interval '15 minutes') >= 20 then
    return jsonb_build_object('lage', 'sparrad');
  end if;
  insert into intern.barn_inloggning_forsok (nyckel) values (ek), (ik);

  select s.anvandarnamn into namn
    from public.barn_epost e
    join public.students s on s.id = e.barn_id
   where e.epost = ny and e.bekraftad is not null and s.user_id is not null and s.raderad_at is null;
  if namn is null then
    return jsonb_build_object('lage', 'okand');
  end if;
  return jsonb_build_object('lage', 'ok', 'adress', namn || '@barn.nextrum.se', 'e', ek, 'i', ik);
end $$;

-- Inloggningen gick: adressens fel nollas, och försöket räknas inte mot
-- numret. En skola bakom ett nummer ska inte spärras av att barnen
-- loggar in.
create or replace function public.barn_inloggning_lyckades(p_e text, p_i text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from intern.barn_inloggning_forsok where nyckel = p_e;
  delete from intern.barn_inloggning_forsok
   where id = (select max(f.id) from intern.barn_inloggning_forsok f where f.nyckel = p_i);
$$;

revoke all on function public.barn_inloggning_uppslag(text, text) from public, anon, authenticated;
revoke all on function public.barn_inloggning_lyckades(text, text) from public, anon, authenticated;
grant execute on function public.barn_inloggning_uppslag(text, text) to service_role;
grant execute on function public.barn_inloggning_lyckades(text, text) to service_role;

-- ------------------------------------------------------------
-- Avanmälan ur ett mejl till barnet (notis-avanmal, service_role).
-- Stänger bara av, aldrig på, och bara barnets egna val.
-- ------------------------------------------------------------
create or replace function public.barn_notis_avregistrera(p_barn uuid, p_typ text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  typer text[];
begin
  if p_typ = 'alla' then
    typer := intern.barn_mejltyper();
  elsif p_typ = any (intern.barn_mejltyper()) then
    typer := array[p_typ];
  else
    raise exception using errcode = '22023', message = 'Okänd notistyp.';
  end if;
  update public.barn_epost e
     set av = array(select distinct x from unnest(e.av || typer) x order by x), uppdaterad = now()
   where e.barn_id = p_barn;
  if not found then
    raise exception using errcode = '22023', message = 'Adressen finns inte.';
  end if;
  return cardinality(typer);
end $$;

revoke all on function public.barn_notis_avregistrera(uuid, text) from public, anon, authenticated;
grant execute on function public.barn_notis_avregistrera(uuid, text) to service_role;

-- ------------------------------------------------------------
-- Lapparna
-- ------------------------------------------------------------
do $$
declare
  fore   text;
  ankare text;
  ny     text;
  n      integer;
  lappar text[][] := array[
    -- 1. notis_utskick_ta: variablerna för barnets rad.
    array['public.notis_utskick_ta(integer)',
          $g$  sms_idag int;
begin
$g$,
          $n$  sms_idag int;
  be       public.barn_epost%rowtype;
  bs       public.students%rowtype;
begin
$n$],
    -- 2. notis_utskick_ta: barnets rad, först i varvet.
    array['public.notis_utskick_ta(integer)',
          $g$  loop
    prov := coalesce((u.data ->> 'prov')::boolean, false);
$g$,
          $n$  loop
    /* BARNETS MEJL (barnets_epost). En rad med barn_id går till barnets
       egen, bekräftade adress och aldrig till kontots tekniska. Allt
       prövas en gång till, med läget just nu: flaggan, adressen,
       förälderns val, barnets egna val, att inloggningen är aktiv och
       att passet fortfarande är bokat på den tiden. */
    if u.barn_id is not null then
      skal := null;
      select * into be from public.barn_epost e where e.barn_id = u.barn_id;
      select * into bs from public.students s where s.id = u.barn_id;
      if u.skicka_senast is not null and u.skicka_senast < now() then
        skal := 'för sent';
      elsif u.kanal <> 'mejl' then
        skal := 'barn får bara mejl';
      elsif not public.flagga_pa('barn_epost') then
        skal := 'barnets e-post är inte påslagen';
      elsif be.barn_id is null or bs.id is null or bs.user_id is null or bs.raderad_at is not null then
        skal := 'barnet har ingen e-post eller ingen inloggning';
      elsif u.typ = 'barn_bekrafta_epost' then
        if be.bekraftad is not null then
          skal := 'adressen är redan bekräftad';
        elsif (u.data ->> 'omgang') is distinct from be.kod_omgang::text then
          skal := 'ersatt av en nyare bekräftelse';
        elsif be.kod_skapad < now() - interval '7 days' then
          skal := 'bekräftelsen hann gå ut';
        end if;
      elsif not intern.barn_vill_mejl(u.barn_id, u.typ) then
        skal := 'avstängt för barnet';
      elsif u.pass_id is null then
        skal := 'passet finns inte längre';
      elsif u.typ in ('barn_pass_bokat', 'barn_paminnelse') and not exists (
              select 1 from public.bookings x
               where x.id = u.pass_id and x.student_id = u.barn_id and x.status = 'confirmed'
                 and x.wanted_date::text = u.data ->> 'datum'
                 and left(coalesce(x.wanted_time, ''), 5) = coalesce(u.data ->> 'tid', '')) then
        skal := 'passet är inte längre bokat på den tiden';
      elsif u.typ = 'barn_pass_avbokat' and not exists (
              select 1 from public.bookings x where x.id = u.pass_id and x.status = 'cancelled') then
        skal := 'passet är inte avbokat';
      end if;

      if skal is not null then
        update public.notis_utskick q set status = 'hoppad', fel = skal, uppdaterad = now() where q.id = u.id;
        continue;
      end if;

      if mejl_pa then
        adress := be.epost;
      elsif drift.mejl_sandlada is not null then
        adress := drift.mejl_sandlada;
      else
        update public.notis_utskick q set status = 'loggad', uppdaterad = now() where q.id = u.id;
        continue;
      end if;
      if lower(coalesce(adress, '')) like '%@barn.nextrum.se' then
        update public.notis_utskick q set status = 'hoppad', fel = 'barnkonton får inga mejl', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;

      update public.notis_utskick q
         set status = 'skickar', lanad_till = now() + interval '5 minutes', forsok = q.forsok + 1,
             till_sandlada = not mejl_pa, uppdaterad = now()
       where q.id = u.id;

      -- Bekräftelsens kod räknas fram här och följer bara med i svaret,
      -- aldrig in i kön. Den blir densamma varje gång, så ett omförsök
      -- skickar samma länk. Bekräftelsen hälsar inte med namn: adressen
      -- är inte bekräftad och kan vara felskriven.
      return query
        select u.id, u.barn_id, u.kanal, u.typ, u.antal,
               case when u.typ = 'barn_bekrafta_epost'
                    then u.data || jsonb_build_object('kod', intern.barn_epost_kod(be.barn_id, be.epost, be.kod_omgang))
                    else u.data end,
               'barn'::text,
               case when u.typ = 'barn_bekrafta_epost' then null else intern.fornamn(bs.name) end,
               adress, null::text, not mejl_pa, drift.sms_lage;
      continue;
    end if;

    prov := coalesce((u.data ->> 'prov')::boolean, false);
$n$],
    -- 3. Barnets mejl om ett bokat eller avbokat pass, bredvid notisen i vyn.
    array['intern.barnnotis_vid_pass()',
          $g$  insert into public.barn_notiser (barn_id, pass_id, typ, text) values (b.id, new.id, vad, besked);
$g$,
          $n$  insert into public.barn_notiser (barn_id, pass_id, typ, text) values (b.id, new.id, vad, besked);
  -- Och mejlet, om barnet har en bekräftad adress och föräldern slagit
  -- på mejlen (barnets_epost). Funktionen sväljer sina egna fel.
  perform intern.barn_passmejl_koa(b.id, new.id, vad, new.wanted_date, new.wanted_time, new.subject, new.tutor_id);
$n$],
    -- 4. Barnets påminnelse, på samma tider som familjens.
    array['public.notis_planera()',
          $g$      end loop;
    end loop;
  end loop;
  return nya;
$g$,
          $n$      end loop;

      -- Barnets egen påminnelse (barnets_epost).
      perform intern.barn_paminnelse_koa(b.id, b.student_id, b.wanted_date, b.wanted_time, b.subject, hjalp, h, b.start);
    end loop;
  end loop;
  return nya;
$n$],
    -- 5. Inloggningen borta: adressen och barnets rader i kön också.
    array['intern.barnkonto_stadas()',
          $g$    delete from public.barn_andringsfonster where barn_id = new.id;
$g$,
          $n$    delete from public.barn_andringsfonster where barn_id = new.id;
    delete from public.barn_epost where barn_id = new.id;
    delete from public.notis_utskick where barn_id = new.id;
$n$],
    -- 6. Gallringen: försöken efter ett dygn, en aldrig bekräftad adress efter 30.
    array['intern.barnkonton_gallra()',
          $g$  delete from public.barn_andringsfonster where giltig_till < now() - interval '1 hour';
$g$,
          $n$  delete from public.barn_andringsfonster where giltig_till < now() - interval '1 hour';
  delete from intern.barn_inloggning_forsok where tid < now() - interval '1 day';
  delete from public.barn_epost where bekraftad is null and kod_skapad < now() - interval '30 days';
$n$]
  ];
  i integer;
begin
  for i in 1 .. array_length(lappar, 1) loop
    fore := pg_get_functiondef(lappar[i][1]::regprocedure);
    ankare := lappar[i][2];
    ny := lappar[i][3];
    if position(ny in fore) > 0 then
      raise notice '% är redan lappad (lapp %).', lappar[i][1], i;
      continue;
    end if;
    n := (length(fore) - length(replace(fore, ankare, ''))) / length(ankare);
    if n <> 1 then
      raise exception '%: texten som ska bytas (lapp %) hittades % gånger, väntat en. Läs driften.',
        lappar[i][1], i, n;
    end if;
    execute replace(fore, ankare, ny);
  end loop;
end $$;
