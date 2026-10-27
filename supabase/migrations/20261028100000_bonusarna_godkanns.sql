-- ============================================================
-- NEXTRUM — värvningsbonusen och tipstimmen godkänns av oss (2026-10-28)
--
-- Leo: "värvnings bonus och tipsa familj bonus. de registreras på samma
-- sätt, men i admin behöver vi godkänna de ifall de ska få de bonusarna".
--
-- VÄRVNINGSBONUSEN. Raden skrivs och prövas som förut (intern.varvning_prova),
-- men när händelsen i varvning_installning inträffat blir den inte intjänad
-- utan att_godkanna: delningen fryses och uppfylld_at säger när, och ingen
-- får något mejl. En superadmin godkänner den (varvningsbonus_godkann(),
-- Värvningsbonus i adminvyn och Att göra): då blir den intjänad, med
-- intjanad_at och godkand_av, mejlet till värvaren köas, och den hör till
-- lönen för den månaden. Eller annullerar den med ett skäl, som förut.
-- Lägena: vantar → att_godkanna|annullerad, att_godkanna →
-- intjanad|annullerad, intjanad → utbetald|annullerad. En levande bonus per
-- person räknar också att_godkanna, så att två inte väntar samtidigt.
--
-- TIPSTIMMEN. Den räknas fortfarande fram och sparas aldrig som ett köp,
-- men den räknas bara när vi godkänt den: en rad i tipstimme_beslut per
-- tipsad familj, godkand eller nekad (med skälet), som aldrig ändras. Den
-- som väntar på beslut syns i adminvyn (tipstimmar_lage()) och i Att göra,
-- och för familjen under Tipsa en familj (mina_tips() → att_godkanna). En
-- godkänd timme gäller i 60 dagar från den dag den både var intjänad och
-- godkänd (det senare av de två), så att väntan på oss inte äter dagarna.
--
-- Villkoren (#tips och tipstimmen) säger att vi godkänner bonusen och
-- timmen, i versionen 2026-10-28, som också säger att Nextrum AB är
-- avtalsparten (bolaget är registrerat).
--
-- Det som fanns lappas med replace() och en vakt som räknar träffarna, eller
-- skrivs om helt bakom en vakt på driftens md5. En kropp som redan bär
-- ändringen släpps igenom: filen går att köra två gånger. Inget delete; ett
-- drop av ett CHECK-villkor (statuslistan), som ersätts i samma sats.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $vakt$
begin
  if to_regclass('public.varvningsbonus') is null then
    raise exception 'varvningsbonus saknas. Kör varvningsbonus först.';
  end if;
  if to_regprocedure('intern.tipstimmar_oanvanda(uuid)') is null then
    raise exception 'intern.tipstimmar_oanvanda saknas. Läs driften.';
  end if;
  if intern.villkor_version() not in ('2026-10-27', '2026-10-28') then
    raise exception 'Villkorens version är %, inte 2026-10-27 som den här filen utgår från. Läs driften.',
      intern.villkor_version();
  end if;
end $vakt$;


-- ---------- 1. värvningsbonusens nya läge ----------
alter table public.varvningsbonus
  add column if not exists uppfylld_at timestamptz,
  add column if not exists godkand_av  uuid;

comment on column public.varvningsbonus.uppfylld_at is
  '2026-10-28 (bonusarna_godkanns). När händelsen inträffade och bonusen blev att_godkanna. intjanad_at är när vi godkände den.';
comment on column public.varvningsbonus.godkand_av is
  '2026-10-28 (bonusarna_godkanns). Vem av oss som godkände bonusen. Null för en som godkändes innan steget fanns.';

alter table public.varvningsbonus
  drop constraint if exists varvningsbonus_status_check,
  add constraint varvningsbonus_status_check
    check (status in ('vantar', 'att_godkanna', 'intjanad', 'utbetald', 'annullerad'));

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.varvningsbonus'::regclass
                   and conname = 'varvningsbonus_att_godkanna') then
    alter table public.varvningsbonus add constraint varvningsbonus_att_godkanna check (
      status <> 'att_godkanna'
      or (uppfylld_at is not null and grundersattning_ore is not null and semester_procent is not null
          and utlosare is not null and intjanad_at is null));
  end if;
end $$;

-- En levande bonus per person räknar också den som väntar på oss. Den
-- gamla (intjanad, utbetald) står kvar: den är en del av den här.
create unique index if not exists varvningsbonus_en_levande_per_person
  on public.varvningsbonus (varvad_epost_hmac) where status in ('att_godkanna', 'intjanad', 'utbetald');


-- ---------- 2. vakten ----------
do $vakt$
declare
  fore text := pg_get_functiondef('intern.varvningsbonus_vakt()'::regprocedure);
begin
  if position('att_godkanna' in fore) = 0 and md5(fore) <> '4e340d4c929eaa68dd550d5fd824ee07' then
    raise exception 'intern.varvningsbonus_vakt är inte den som lästes (md5 %). Läs driften.', md5(fore);
  end if;
end $vakt$;

/* Lägena och det som står fast. vantar → att_godkanna|annullerad,
   att_godkanna → intjanad|annullerad, intjanad → utbetald|annullerad;
   utbetald och annullerad är slutgiltiga. Vem bonusen gäller, bruttot och
   delningen ändras aldrig; ansökan och kontot bara till null (gallring och
   radering), och kontot kopplas en gång. */
create or replace function intern.varvningsbonus_vakt()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21); bonusarna_godkanns (2026-10-28): att_godkanna.
begin
  -- Ansökan gallras eller tas bort innan bonusen tjänats in (nyckeln blir
  -- null genom främmande nyckeln): den kan inte längre bli ett konto.
  if old.status = 'vantar' and new.status = 'vantar' and old.varvad_ansokan_id is not null
     and new.varvad_ansokan_id is null and pg_trigger_depth() > 1 then
    new.status := 'annullerad';
    new.annullerad_at := now();
    new.annullerad_orsak := 'Ansökan gallrades eller togs bort innan bonusen tjänades in.';
  end if;
  if new.id is distinct from old.id
     or new.varvare_profil_id is distinct from old.varvare_profil_id
     or new.varvad_epost_hmac is distinct from old.varvad_epost_hmac
     or new.brutto_ore is distinct from old.brutto_ore
     or new.skapad_at is distinct from old.skapad_at
     or new.tipsbonus_id is distinct from old.tipsbonus_id then
    raise exception using errcode = '42501', message = 'Vem bonusen gäller och beloppet står fast.';
  end if;
  if new.varvad_ansokan_id is distinct from old.varvad_ansokan_id and new.varvad_ansokan_id is not null then
    raise exception using errcode = '42501', message = 'Ansökan en bonus kom ur byts inte.';
  end if;
  if new.varvad_profil_id is distinct from old.varvad_profil_id and new.varvad_profil_id is not null
     and (old.varvad_profil_id is not null or old.status <> 'vantar') then
    raise exception using errcode = '42501', message = 'Kontot en bonus gäller kopplas en gång.';
  end if;
  if old.grundersattning_ore is not null
     and (new.grundersattning_ore is distinct from old.grundersattning_ore
          or new.semesterersattning_ore is distinct from old.semesterersattning_ore
          or new.semester_procent is distinct from old.semester_procent) then
    raise exception using errcode = '42501', message = 'Delningen av en intjänad bonus står fast.';
  end if;
  if (old.intjanad_at is not null and new.intjanad_at is distinct from old.intjanad_at)
     or (old.uppfylld_at is not null and new.uppfylld_at is distinct from old.uppfylld_at)
     or (old.utlosare is not null and new.utlosare is distinct from old.utlosare) then
    raise exception using errcode = '42501', message = 'När och hur en bonus tjänades in står fast.';
  end if;

  if new.status is distinct from old.status then
    if not ((old.status = 'vantar' and new.status in ('att_godkanna', 'annullerad'))
            or (old.status = 'att_godkanna' and new.status in ('intjanad', 'annullerad'))
            or (old.status = 'intjanad' and new.status in ('utbetald', 'annullerad'))) then
      raise exception using errcode = '23514',
        message = format('En värvningsbonus går inte från %s till %s.', old.status, new.status);
    end if;
    if new.status = 'att_godkanna' and new.varvad_profil_id is null then
      raise exception using errcode = '23514', message = 'En bonus tjänas in för ett konto.';
    end if;
    -- Godkänd av oss: bara från att_godkanna, och bara då skrivs godkand_av.
    if (new.godkand_av is distinct from old.godkand_av)
       and not (old.status = 'att_godkanna' and new.status = 'intjanad' and old.godkand_av is null) then
      raise exception using errcode = '23514', message = 'Vem som godkände en bonus skrivs när den godkänns.';
    end if;
    if old.status = 'att_godkanna' and new.status = 'intjanad'
       and (new.godkand_av is null or new.intjanad_at is null) then
      raise exception using errcode = '23514', message = 'En bonus godkänns av någon av oss, med dagen.';
    end if;
  elsif new.utbetald_at is distinct from old.utbetald_at
        or new.utbetald_period is distinct from old.utbetald_period
        or new.annullerad_at is distinct from old.annullerad_at
        or new.annullerad_orsak is distinct from old.annullerad_orsak
        or new.andrad_av is distinct from old.andrad_av
        or new.godkand_av is distinct from old.godkand_av
        or new.intjanad_at is distinct from old.intjanad_at
        or new.uppfylld_at is distinct from old.uppfylld_at then
    raise exception using errcode = '23514', message = 'Godkänd, utbetald och annullerad sätts när läget byts.';
  end if;

  if old.status in ('utbetald', 'annullerad')
     and (to_jsonb(new) - 'varvad_ansokan_id' - 'varvad_profil_id')
         is distinct from (to_jsonb(old) - 'varvad_ansokan_id' - 'varvad_profil_id') then
    raise exception using errcode = '23514', message = 'En utbetald eller annullerad bonus ändras inte.';
  end if;
  return new;
end $function$;

revoke all on function intern.varvningsbonus_vakt() from public, anon, authenticated;


-- ---------- 3. intjänandet väntar på oss ----------
do $lapp$
declare
  fore    text := pg_get_functiondef('intern.varvning_prova(uuid)'::regprocedure);
  traffar integer;
  a1 text := $a$x.status in ('intjanad', 'utbetald')$a$;
  b1 text := $b$x.status in ('att_godkanna', 'intjanad', 'utbetald')$b$;
  a2 text := $a$set status = 'intjanad', intjanad_at = now(), semester_procent$a$;
  b2 text := $b$set status = 'att_godkanna', uppfylld_at = now(), semester_procent$b$;
  a3 text := $a$  -- Mejlet till värvaren: bara beloppet och att den hanteras enligt villkoren.
  begin
    data := jsonb_build_object('belopp', v.brutto_ore);
    insert into public.notiser (mottagare, typ, trad_tutor, data)
    values (v.varvare_profil_id, 'varvningsbonus', v.varvare_profil_id, data);
    if public.notis_vill(v.varvare_profil_id, 'varvningsbonus', 'mejl') then
      perform intern.notis_koa(v.varvare_profil_id, 'mejl', 'varvningsbonus', null, null, v.varvare_profil_id, data, null,
        'varvningsbonus:mejl:' || v.id, now(), null);
    end if;
  exception when others then
    -- Ett mejl som inte gick att köa får aldrig ta bonusen med sig.
    insert into public.notis_fel (kalla, fel) values ('varvningsbonus ' || v.id, left(sqlerrm, 500));
  end;
  return 'intjanad';$a$;
  b3 text := $b$  -- bonusarna_godkanns (2026-10-28): vi godkänner bonusen i adminvyn
  -- (varvningsbonus_godkann), och mejlet till värvaren går först då.
  return 'att_godkanna';$b$;
begin
  if position('att_godkanna' in fore) > 0 then
    return;
  end if;
  if md5(fore) <> 'fe3a3b6554e04550eea7fac5f1f967eb' then
    raise exception 'intern.varvning_prova är inte den som lästes (md5 %). Läs driften.', md5(fore);
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then raise exception 'varvning_prova: % träffar på personen som redan gett en bonus.', traffar; end if;
  traffar := (length(fore) - length(replace(fore, a2, ''))) / length(a2);
  if traffar <> 1 then raise exception 'varvning_prova: % träffar på intjänandet.', traffar; end if;
  traffar := (length(fore) - length(replace(fore, a3, ''))) / length(a3);
  if traffar <> 1 then raise exception 'varvning_prova: % träffar på mejlet.', traffar; end if;
  execute replace(replace(replace(fore, a1, b1), a2, b2), a3, b3);
end $lapp$;


/* Koden står fast när bonusen väntar på oss, och en ny ansökan från den
   som redan väntar på en bonus räknas inte som ny: att_godkanna är lika
   levande som intjanad. */
do $lapp$
declare
  fore    text;
  traffar integer;
  par     text[][] := array[
    array['intern.ansokan_tipskod()',
          $a$x.varvad_ansokan_id = new.id and x.status in ('intjanad', 'utbetald')$a$,
          $b$x.varvad_ansokan_id = new.id and x.status in ('att_godkanna', 'intjanad', 'utbetald')$b$],
    array['intern.varvning_skapa()',
          $a$v.varvad_epost_hmac = h and v.status in ('intjanad', 'utbetald')$a$,
          $b$v.varvad_epost_hmac = h and v.status in ('att_godkanna', 'intjanad', 'utbetald')$b$]];
  i       integer;
begin
  for i in 1 .. array_length(par, 1) loop
    fore := pg_get_functiondef(par[i][1]::regprocedure);
    if position(par[i][3] in fore) > 0 then
      continue;
    end if;
    traffar := (length(fore) - length(replace(fore, par[i][2], ''))) / length(par[i][2]);
    if traffar <> 1 then
      raise exception '%: % träffar på en intjänad bonus. Läs driften.', par[i][1], traffar;
    end if;
    execute replace(fore, par[i][2], par[i][3]);
  end loop;
end $lapp$;


-- ---------- 4. godkänn ----------
/* Godkänn en bonus som väntar på oss: den blir intjänad i dag, och mejlet
   till värvaren köas. Svarar 'intjanad', eller läget den redan hade. Bara
   superadmin. Värvaren ska fortfarande vara godkänd och kontot kvar. */
create or replace function public.varvningsbonus_godkann(p_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- bonusarna_godkanns (2026-10-28).
declare
  v    public.varvningsbonus%rowtype;
  data jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin godkänner en bonus.';
  end if;
  select * into v from public.varvningsbonus x where x.id = p_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Bonusen finns inte.';
  end if;
  if v.status <> 'att_godkanna' then
    return v.status;
  end if;
  if not exists (select 1 from public.tutor_profiles t join public.profiles p on p.id = t.id
                  where t.id = v.varvare_profil_id and t.status = 'approved' and p.raderad_at is null) then
    raise exception using errcode = '23514',
      message = 'Värvaren är inte godkänd och aktiv. Annullera bonusen med ett skäl i stället.';
  end if;
  update public.varvningsbonus x
     set status = 'intjanad', intjanad_at = now(), godkand_av = auth.uid(), andrad_av = auth.uid()
   where x.id = p_id;

  -- Mejlet till värvaren: bara beloppet och att den hanteras enligt villkoren.
  begin
    data := jsonb_build_object('belopp', v.brutto_ore);
    insert into public.notiser (mottagare, typ, trad_tutor, data)
    values (v.varvare_profil_id, 'varvningsbonus', v.varvare_profil_id, data);
    if public.notis_vill(v.varvare_profil_id, 'varvningsbonus', 'mejl') then
      perform intern.notis_koa(v.varvare_profil_id, 'mejl', 'varvningsbonus', null, null, v.varvare_profil_id, data, null,
        'varvningsbonus:mejl:' || v.id, now(), null);
    end if;
  exception when others then
    -- Ett mejl som inte gick att köa får aldrig ta bonusen med sig.
    insert into public.notis_fel (kalla, fel) values ('varvningsbonus ' || v.id, left(sqlerrm, 500));
  end;
  return 'intjanad';
end $function$;

revoke all on function public.varvningsbonus_godkann(uuid) from public, anon;
grant execute on function public.varvningsbonus_godkann(uuid) to authenticated;

comment on function public.varvningsbonus_godkann(uuid) is
  '2026-10-28 (bonusarna_godkanns). Godkänn en bonus som väntar på oss: intjänad i dag, och mejlet till värvaren köas. Bara superadmin.';
comment on function public.varvningsbonus_annullera(uuid, text) is
  '2026-10-21 (varvningsbonus). Annullera en väntande, en som väntar på oss (2026-10-28) eller en intjänad bonus med ett skäl. Bara superadmin.';


-- ---------- 5. raderingen ----------
/* En värvare med en bonus som väntar på oss raderas inte heller: den kan
   bli lön. */
do $lapp$
declare
  fore    text := pg_get_functiondef('intern.radering_underlag(text,uuid)'::regprocedure);
  traffar integer;
  a1 text := $a$where t.varvare_profil_id = p_id and t.status = 'intjanad';$a$;
  b1 text := $b$where t.varvare_profil_id = p_id and t.status in ('att_godkanna', 'intjanad');$b$;
begin
  if position(b1 in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'radering_underlag: % träffar på värvningsbonusens hinder. Läs driften.', traffar;
  end if;
  execute replace(fore, a1, b1);
end $lapp$;


-- ---------- 6. tipstimmens beslut ----------
create table if not exists public.tipstimme_beslut (
  -- Den tipsade familjen: den ger en timme till den som tipsade
  -- (intern.tipsade_familjer tar familjens första kod).
  tipsad_id    uuid primary key references public.profiles(id) on delete cascade,
  tipsare_id   uuid not null references public.profiles(id) on delete cascade,
  beslut       text not null check (beslut in ('godkand', 'nekad')),
  orsak        text check (orsak is null or char_length(btrim(orsak)) between 3 and 500),
  beslutad_at  timestamptz not null default now(),
  beslutad_av  uuid,
  constraint tipstimme_beslut_nej_med_skal check (beslut = 'godkand' or orsak is not null)
);

comment on table public.tipstimme_beslut is
  '2026-10-28 (bonusarna_godkanns). Vårt beslut om tipstimmen för en tipsad familj: godkand eller nekad med skälet. '
  'En rad per tipsad familj, skriven bara av tipstimme_besluta(), och den ändras aldrig. Tipstimmen räknas bara när den '
  'är godkänd, och gäller 60 dagar från det senare av intjänad och godkänd.';

create or replace function intern.tipstimme_beslut_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- bonusarna_godkanns (2026-10-28).
begin
  raise exception using errcode = '42501', message = 'Ett beslut om en tipstimme ändras inte.';
end $function$;

revoke all on function intern.tipstimme_beslut_star_fast() from public, anon, authenticated;

create or replace trigger tipstimme_beslut_star_fast
  before update on public.tipstimme_beslut
  for each row execute function intern.tipstimme_beslut_star_fast();

alter table public.tipstimme_beslut enable row level security;
revoke all on public.tipstimme_beslut from anon, authenticated;
do $$
declare
  roll text;
begin
  foreach roll in array array['nextrum_barn', 'nextrum_ai'] loop
    if exists (select 1 from pg_roles where rolname = roll) then
      execute format('revoke all on public.tipstimme_beslut from %I', roll);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke insert, update, delete, truncate on public.tipstimme_beslut from service_role;
  end if;
end $$;
grant select on public.tipstimme_beslut to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipstimme_beslut'
                   and policyname = 'admin läser tipstimmarnas beslut') then
    create policy "admin läser tipstimmarnas beslut" on public.tipstimme_beslut
      for select to authenticated using (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tipstimme_beslut_audit'
                   and tgrelid = 'public.tipstimme_beslut'::regclass) then
    -- Aldrig skälet: det är fritext.
    create trigger tipstimme_beslut_audit
      after insert on public.tipstimme_beslut
      for each row execute function public.logga_andring('tipstimme_beslut', 'tipsad_id', 'tipsare_id', 'beslut',
        'beslutad_av');
  end if;
end $$;

/* Varje intjänad tipstimme: den som tipsade, den tipsade familjen och dagen
   den tipsade familjen haft två timmar. Som förut räknas det som tjänades in
   innan erbjudandet stängdes. Med en familj bara dess egna. */
create or replace function intern.tipstimmar_rader(p_familj uuid default null)
 returns table(tipsare_id uuid, tipsad_id uuid, dag date)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- bonusarna_godkanns (2026-10-28).
  select k.person_id, t.kund_id, h.dag
    from public.tipskoder k
    cross join lateral intern.tipsade_familjer(k.kod) t
    cross join lateral (select intern.tva_timmar_hallna(t.kund_id) as dag) h
    left join public.flaggor f on f.kod = 'tipstimme'
   where k.sort = 'familj' and h.dag is not null
     and (p_familj is null or k.person_id = p_familj)
     -- Står erbjudandet av räknas det som tjänades in innan det stängdes.
     and (coalesce(f.aktiv, false)
          or h.dag < (f.uppdaterad at time zone 'Europe/Stockholm')::date)
$function$;

revoke all on function intern.tipstimmar_rader(uuid) from public, anon, authenticated;

/* De godkända, med dagen 60-dagarsperioden räknas från: det senare av
   intjänad och godkänd. */
create or replace function intern.tipstimmar_godkanda(p_familj uuid)
 returns table(tipsad_id uuid, fran date)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- bonusarna_godkanns (2026-10-28).
  select r.tipsad_id, greatest(r.dag, (b.beslutad_at at time zone 'Europe/Stockholm')::date)
    from intern.tipstimmar_rader(p_familj) r
    join public.tipstimme_beslut b on b.tipsad_id = r.tipsad_id and b.tipsare_id = r.tipsare_id
   where b.beslut = 'godkand'
$function$;

revoke all on function intern.tipstimmar_godkanda(uuid) from public, anon, authenticated;

do $vakt$
declare
  f text;
  m text;
begin
  foreach f in array array['intern.tipstimmar_intjanade(uuid)', 'intern.tipstimmar_oanvanda(uuid)'] loop
    m := md5(pg_get_functiondef(f::regprocedure));
    if position('tipstimmar_godkanda' in pg_get_functiondef(f::regprocedure)) = 0
       and m not in ('65f9c53b7f8b0fd097fc02e45d3abcad', 'db5f0bad319ce9fb274bf3265e64c935') then
      raise exception '% är inte den som lästes (md5 %). Läs driften.', f, m;
    end if;
  end loop;
end $vakt$;

create or replace function intern.tipstimmar_intjanade(p_familj uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- bonusarna_godkanns (2026-10-28): bara de vi godkänt.
  select count(*)::integer from intern.tipstimmar_godkanda(p_familj)
$function$;

create or replace function intern.tipstimmar_oanvanda(p_familj uuid)
 returns setof date
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
-- bonusarna_godkanns (2026-10-28): bara de vi godkänt, och de 60 dagarna
-- räknas från det senare av intjänad och godkänd.
declare
  intjanade date[];
  tagen     boolean[];
  pass      record;
  i         integer;
  n         integer;
  hittad    boolean;
begin
  select coalesce(array_agg(g.fran order by g.fran), '{}'::date[]) into intjanade
    from intern.tipstimmar_godkanda(p_familj) g;
  n := coalesce(array_length(intjanade, 1), 0);
  if n = 0 then
    return;
  end if;
  tagen := array_fill(false, array[n]);

  for pass in
    select greatest((x.created_at at time zone 'Europe/Stockholm')::date,
                    coalesce(x.wanted_date, (x.created_at at time zone 'Europe/Stockholm')::date)) as galler
      from public.bookings x
     where x.parent_id = p_familj and x.rabattkod = 'TIPS'
       -- sen_avbokning (2026-10-22): som intern.tipstimmar_anvanda.
       and (x.status <> 'cancelled' or x.sen_avbokning_minuter is not null)
     order by x.created_at, x.id
  loop
    hittad := false;
    for i in 1 .. n loop
      if not tagen[i] and intjanade[i] + 60 >= pass.galler then
        tagen[i] := true;
        hittad := true;
        exit;
      end if;
    end loop;
    if not hittad then
      for i in 1 .. n loop
        if not tagen[i] then
          tagen[i] := true;
          exit;
        end if;
      end loop;
    end if;
  end loop;

  for i in 1 .. n loop
    if not tagen[i] then
      return next intjanade[i] + 60;
    end if;
  end loop;
end $function$;

revoke all on function intern.tipstimmar_intjanade(uuid) from public, anon, authenticated;
revoke all on function intern.tipstimmar_oanvanda(uuid) from public, anon, authenticated;
do $$
begin
  -- klippkort-betala kör klippkort_dra med tjänstekontot, och den frågar
  -- tipstimmarna (timmarna_delas_och_kops_till rättade samma sak 2026-10-14).
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function intern.tipstimmar_rader(uuid), intern.tipstimmar_godkanda(uuid) to service_role;
  end if;
end $$;

/* Adminvyns lista: varje intjänad tipstimme, med beslutet om det finns.
   Bara superadmin. */
create or replace function public.tipstimmar_lage()
 returns table(tipsare_id uuid, tipsad_id uuid, tva_timmar date, beslut text, orsak text, beslutad_at timestamptz,
               beslutad_av uuid)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
-- bonusarna_godkanns (2026-10-28).
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin ser tipstimmarna.';
  end if;
  return query
    select r.tipsare_id, r.tipsad_id, r.dag, b.beslut, b.orsak, b.beslutad_at, b.beslutad_av
      from intern.tipstimmar_rader(null) r
      left join public.tipstimme_beslut b on b.tipsad_id = r.tipsad_id
     order by (b.beslut is null) desc, r.dag desc, r.tipsad_id;
end $function$;

revoke all on function public.tipstimmar_lage() from public, anon;
grant execute on function public.tipstimmar_lage() to authenticated;

/* Godkänn eller neka tipstimmen för en tipsad familj, en gång. Ett nej
   kräver skälet. Svarar beslutet, eller 'redan' när det finns ett. */
create or replace function public.tipstimme_besluta(p_tipsad uuid, p_godkann boolean, p_orsak text default null)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- bonusarna_godkanns (2026-10-28).
declare
  r record;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin godkänner en tipstimme.';
  end if;
  if p_godkann is null then
    raise exception using errcode = '22023', message = 'Säg ja eller nej.';
  end if;
  if not p_godkann and (p_orsak is null or char_length(btrim(p_orsak)) not between 3 and 500) then
    raise exception using errcode = '22023', message = 'Skriv skälet, 3–500 tecken.';
  end if;
  if exists (select 1 from public.tipstimme_beslut b where b.tipsad_id = p_tipsad) then
    return 'redan';
  end if;
  select * into r from intern.tipstimmar_rader(null) x where x.tipsad_id = p_tipsad limit 1;
  if not found then
    raise exception using errcode = '22023', message = 'Familjen har inte gett någon tipstimme än.';
  end if;
  insert into public.tipstimme_beslut (tipsad_id, tipsare_id, beslut, orsak, beslutad_av)
  values (p_tipsad, r.tipsare_id, case when p_godkann then 'godkand' else 'nekad' end,
          nullif(btrim(coalesce(p_orsak, '')), ''), auth.uid())
  on conflict (tipsad_id) do nothing;
  if not found then
    return 'redan';
  end if;
  return case when p_godkann then 'godkand' else 'nekad' end;
end $function$;

revoke all on function public.tipstimme_besluta(uuid, boolean, text) from public, anon;
grant execute on function public.tipstimme_besluta(uuid, boolean, text) to authenticated;

comment on function public.tipstimmar_lage() is
  '2026-10-28 (bonusarna_godkanns). Varje intjänad tipstimme med vårt beslut, de utan beslut först. Bara superadmin.';
comment on function public.tipstimme_besluta(uuid, boolean, text) is
  '2026-10-28 (bonusarna_godkanns). Godkänn eller neka (med skälet) tipstimmen för en tipsad familj, en gång. Bara superadmin.';


-- ---------- 7. familjen ser att timmen väntar på oss ----------
do $lapp$
declare
  fore    text := pg_get_functiondef('public.mina_tips()'::regprocedure);
  traffar integer;
  a1 text := $a$      'anvanda', anvanda,$a$;
  b1 text := $b$      'anvanda', anvanda,
      -- bonusarna_godkanns (2026-10-28): intjänade som väntar på vårt beslut.
      'att_godkanna', (select count(*) from intern.tipstimmar_rader(jag) r
                        where not exists (select 1 from public.tipstimme_beslut b where b.tipsad_id = r.tipsad_id)),$b$;
begin
  if position('att_godkanna' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'mina_tips: % träffar på familjens timmar. Läs driften.', traffar;
  end if;
  execute replace(fore, a1, b1);
end $lapp$;


-- ---------- 8. Att göra och morgonmejlet ----------
do $vakt$
declare
  fore text := pg_get_functiondef('intern.admin_att_gora()'::regprocedure);
begin
  if position('bonus_godkann' in fore) = 0 and md5(fore) <> '8a58f2f867782984e1c4223659599065' then
    raise exception 'intern.admin_att_gora är inte den som lästes (md5 %). Läs driften.', md5(fore);
  end if;
end $vakt$;

create or replace function intern.admin_att_gora()
 returns table(typ text, objekt_id text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  -- fakturan_tas_bort (2026-10-21): inga fakturor att lägga in eller driva in.
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
   where p.fakturerbar and not p.har_rapport and not p.pa_underlag
  union all
  select 'utbetalning', u.id::text from public.payouts u where u.status in ('utkast', 'godkand')
  -- bonusarna_godkanns (2026-10-28): värvningsbonusar och tipstimmar som
  -- väntar på vårt beslut. Samma urval som byggAttGöra i adminvyn.
  union all
  select 'bonus_godkann', v.id::text from public.varvningsbonus v where v.status = 'att_godkanna'
  union all
  select 'bonus_godkann', 'tips:' || r.tipsad_id::text from intern.tipstimmar_rader(null) r
   where not exists (select 1 from public.tipstimme_beslut b where b.tipsad_id = r.tipsad_id)
  -- betala_nu (2026-10-21): familjen bekräftar inte rapporten längre.
  -- Bara här: det systemet själv lagt (kontrollerna, månadskörningens svar).
  union all
  select 'uppgift', u.id::text from public.uppgifter u
   where u.status in ('oppen', 'pagar') and u.skapad_av_typ in ('system', 'ai')
$function$;


-- ---------- 9. villkorens version ----------
-- Användarvillkoren 2026-10-28: Nextrum AB är avtalsparten, och vi
-- godkänner värvningsbonusen och tipstimmen. Alla får frågan igen.
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-28'::text $$;
