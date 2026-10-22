-- ============================================================
-- Sen avbokning: hälften av passet inom 12 timmar (2026-10-22)
--
-- Leo: "minst 12h innan måste det avbokas, avbokas det inom 12h av att
-- lektionen ska hållas betalas 50% av belopp, eller spenderas hälften av
-- planerade timmar för lektionen". Till nu kostade en avbokning ingenting
-- fram till att passet hölls (villkoren, "Att boka, flytta och avboka"), och
-- skydda_bokningsfalt sa redan att en avbokning inte betalar tillbaka något
-- av sig själv, "för den policyn är inte skriven än".
--
-- Regeln: familjen avbokar ett bokat pass (bekräftat av båda) mindre än 12
-- timmar före start. Passet räknas då som hållet i halva den bokade tiden,
-- med samma regler som ett pass som blev kortare:
--   · betalt med timmar ur planer eller timbanken: halva tiden dras, resten
--     kommer tillbaka, och det som blir över av en köpt timme sparas i
--     timbanken (intern.debiterade_min, kortets_anvanda, timbank_in);
--   · i pengar: avgiften är priset för halva tiden, minus rabatten
--     (intern.sen_avbokningens_pris), hälften av passets pris. Obetald
--     betalas den med Betala nu; betald dras den från det vi betalar
--     tillbaka (avvikelsen betald_men_avbokad).
-- Ett förslag som inte är bekräftat dras tillbaka utan kostnad, och
-- studiehjälparens och Nextrums avbokningar kostar ingenting. Familjen kan
-- inte avboka ett betalt pass själv (skydda_bokningsfalt), så Nextrum gör
-- det och säger då om det var familjens begäran (avbokad_for_familjen):
-- samma regel. Nextrum kan efterskänka avgiften efteråt, och bara det.
-- Inom gränsen flyttar familjen inte ett bokat pass: att flytta det och dra
-- tillbaka förslaget hade varit en sen avbokning utan avgift (samma spärr
-- som syskontillägget hade, med 24 timmar, sedan 2026-10-21).
--
-- Regeln gäller ett pass som föreslogs efter att familjen godkänt villkoren
-- 2026-10-23 eller senare (intern.familjen_har_avbokningsregeln), aldrig ett
-- som bokades på de gamla. Villkorens version blir 2026-10-23: en hade
-- godkänt 2026-10-22 när filen skrevs. Syskontillägget följer samma regel
-- (hälften av posten), och dess villkorstext (#syskontillagg) står i samma
-- version. Studiehjälparen får ingen lön för ett sent avbokat pass (som för
-- varje pass som inte hölls; passunderlag räknar bara genomförda).
--
-- Inget drop och inget delete. Vakten först: varje funktion som skrivs om
-- ska ha driftens kropp från 2026-10-22, eller filens egen (filen går att
-- köra två gånger).
-- ============================================================

set local lock_timeout = '5s';

do $$
declare
  r  record;
  nu text;
begin
  for r in select * from (values
    ('public.stampla_avbokningen()', 'd48d80a83d9cef9fc0386648b34507c4', '81e098ce82b96122de72ee560bd7f9cf'),
    ('public.klippkortspass_avbokat()', 'e2153c7549d7ccdb74c904dcc7749a6d', '294d2fd9e28877e2e2fe2dc61878ac88'),
    ('intern.debiterade_min(uuid)', 'faf009a4d6a8a11dbf0f25aa2e191cb2', '7ad3b9b03f6a7086ebdcb0cb1f5566c3'),
    ('intern.kortets_anvanda(uuid,uuid)', 'ae4cde05f928ec50083058702636f958', '93e48466f06a816a8f4fd736e77ec44c'),
    ('intern.timbank_in(public.bookings)', 'b0c70c631c8c5b355f3802aa54fe9046', '6a82c922e5f1a4c01923cf2ae557c35a'),
    ('intern.timbank_saldo(uuid)', '553f579717555835557f3d4e5f46eb44', '6705b0805fd88c0de850b80920308a95'),
    ('intern.tipstimmar_anvanda(uuid)', 'd5c18d5391d7a96d93a35dcb914c6e40', 'a5ac1742310246a3c0bc772231bcd666'),
    ('intern.tipstimmar_oanvanda(uuid)', '88c10d9b3554fee88251e90a69576a86', 'a22da4ab32e6ec927e94e01ee554b068'),
    ('intern.forsta_timmen_tagen(uuid)', 'e765f3524418857fe261843a4217fe24', 'c752eb5a87363f733de7b5b5447fa2e9'),
    ('public.forsta_timmen_lage(uuid)', '4241574a60a52d98e827d90501ef673d', '622a2c11db532b54874b80d5c3654945'),
    ('public.avvikelser_rader()', '4ad773f59879008d9f1fb7a84687f459', '82c03bf1d62803ef31ce46f16ff55f81'),
    ('public.kontroll_ekonomiska_avvikelser()', '7608c37efd1d6e5c7907f0ed6f501f3e', '7aa3d6325007c046a706108e34e6da44'),
    ('intern.passet_betalt_ej_hallet(public.bookings)', '42251b2d4293ce24f0e132026a53bdca', '10248f40f0b9fdb22912b4b5af47c7f3'),
    ('intern.radering_underlag(text,uuid)', 'ecdf331857d417d234ad70873cd7b767', '9ada851b0c5145be42ae9a44bfce29be'),
    ('intern.bookings_syskon_foljer()', '8a693137733ea5fd59d22f16c10fb28e', '73f90e524df4539079b54d25b0140288'),
    ('intern.bookings_syskon_star_fast()', '5e2a300d3ba2a804a84735b4bdc625cf', 'b6d3e5d4db3e816d2cf8d0cded95c349'),
    ('intern.tillagg_poster_vakt()', '0b4a691833dab132bbe94aa25a8196ae', 'edd9ff941a1dd6ba50f6a1122f9017f4'),
    ('public.mitt_tillagg()', 'e5dc1c4cd23a3439f5da0607789eca23', '03520988e8e88230fe32dc8c77719928'),
    ('public.notis_vid_pass()', 'b8a55c8a1e1a46b78f9f5018ef5a7a01', '51684c71cb399f1e2c6ea7d749a033e4'),
    ('intern.villkor_version()', '1cb09db1231a5ae39fd0a0d9c76b25e3', '3a77f7822064224ced9b8c273d4fc5df')
  ) v(sig, gammal, ny) loop
    select md5(p.prosrc) into nu from pg_proc p where p.oid = to_regprocedure(r.sig);
    if nu is null then
      raise exception 'sen_avbokning: % finns inte. Inget har ändrats.', r.sig;
    end if;
    if nu is distinct from r.gammal and nu is distinct from r.ny then
      raise exception 'sen_avbokning: % har ändrats sedan filen skrevs (md5 %). Läs driften först; inget har ändrats.', r.sig, nu;
    end if;
  end loop;
end $$;

-- ---------- 1. regeln: 12 timmar och hälften ----------
-- Gränsen och andelen står i villkoren (#avbokning), och en ändring är en ny
-- version av dem. Därför är de låsta, som sen_avbokning_timmar, som är
-- kortreservationens (vilande) och står kvar på 0.
alter table public.betalning_installning
  add column if not exists avbokning_avgift_timmar integer not null default 12
    constraint betalning_installning_avgift_timmar check (avbokning_avgift_timmar = 12),
  add column if not exists avbokning_avgift_procent integer not null default 50
    constraint betalning_installning_avgift_procent check (avbokning_avgift_procent = 50);

comment on column public.betalning_installning.avbokning_avgift_timmar is
  'sen_avbokning (2026-10-22). Avbokar familjen ett bokat pass mindre än så här många timmar före start är det en sen '
  'avbokning (stampla_avbokningen). Låst på 12: villkoren säger det, och en ändring är en ny version av dem.';
comment on column public.betalning_installning.avbokning_avgift_procent is
  'sen_avbokning (2026-10-22). Hur stor del av den bokade tiden ett sent avbokat pass räknas som hållet i. Låst på 50, '
  'av samma skäl.';
comment on column public.betalning_installning.sen_avbokning_timmar is
  'kortdragningen_forsoker_igen (2026-10-21). Kortreservationens gräns (intern.sen_avbokning), vilande med '
  'kortreservation av, och låst på 0. Avgiften för en sen avbokning står i avbokning_avgift_timmar och '
  'avbokning_avgift_procent (sen_avbokning, 2026-10-22).';

-- ---------- 2. passet bär avgiften ----------
alter table public.bookings
  add column if not exists sen_avbokning_minuter integer,
  add column if not exists sen_avbokning_ore integer,
  add column if not exists avbokad_for_familjen boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.bookings'::regclass and conname = 'bookings_sen_avbokning') then
    alter table public.bookings add constraint bookings_sen_avbokning check (
      (sen_avbokning_minuter is null and sen_avbokning_ore is null)
      or (status = 'cancelled'
          and sen_avbokning_minuter is not null and sen_avbokning_ore is not null
          and sen_avbokning_minuter between 15 and 180 and sen_avbokning_ore >= 0));
  end if;
end $$;

comment on column public.bookings.sen_avbokning_minuter is
  'sen_avbokning (2026-10-22). Satt när familjen avbokat passet sent: den tid passet räknas som hållet i, hälften av '
  'den bokade. Timmarna dras för den (intern.debiterade_min). Bara stampla_avbokningen sätter den, och efteråt kan '
  'Nextrum bara efterskänka den (båda kolumnerna null).';
comment on column public.bookings.sen_avbokning_ore is
  'sen_avbokning (2026-10-22). Vad familjen ska betala i pengar för den sena avbokningen: priset för '
  'sen_avbokning_minuter minus rabatten, och 0 när timmarna betalade passet (intern.sen_avbokningens_pris). Betalas '
  'med Betala nu, eller dras från det vi betalar tillbaka.';
comment on column public.bookings.avbokad_for_familjen is
  'sen_avbokning (2026-10-22). Nextrum avbokade passet på familjens begäran (familjen kan inte avboka ett betalt '
  'pass själv), och då gäller regeln för sen avbokning som om familjen gjort det. Bara admin sätter den.';

-- ---------- 3. regelns delar ----------
create or replace function intern.avbokningen_ar_sen(p_start timestamptz, p_nu timestamptz)
 returns boolean
 language sql
 stable
 set search_path to ''
as $function$
  -- sen_avbokning (2026-10-22). Sant när det är mindre än gränsen kvar till
  -- start, också när passet redan har börjat. Exakt på gränsen är i tid
  -- ("minst 12h innan"). Utan inställningen aldrig.
  select coalesce((select p_start - p_nu < make_interval(hours => i.avbokning_avgift_timmar)
                     from public.betalning_installning i where i.id = 1), false)
     and p_start is not null and p_nu is not null
$function$;

create or replace function intern.sen_avbokningens_minuter(p_langd integer)
 returns integer
 language sql
 stable
 set search_path to ''
as $function$
  -- sen_avbokning (2026-10-22). Den del av den bokade tiden ett sent avbokat
  -- pass räknas som hållet i, i hela kvartar: 60 ger 30, 120 ger 60, 180 ger 90.
  select greatest(15, (round(coalesce(p_langd, 60)
                             * coalesce((select i.avbokning_avgift_procent from public.betalning_installning i
                                          where i.id = 1), 50)
                             / 100.0 / 15) * 15)::integer)
$function$;

create or replace function intern.sen_avbokningens_pris(b public.bookings, p_minuter integer)
 returns integer
 language sql
 stable
 set search_path to ''
as $function$
  -- sen_avbokning (2026-10-22). Vad familjen betalar i pengar för ett pass
  -- som räknas som hållet i p_minuter: samma regel som kassan
  -- (familjebelopp i _delad/pris.ts, NXBetalning.passpris), med passets
  -- frysta pris och rabatt. Ett pass som timmarna betalade kostar inga
  -- pengar, för timmarna betalar tiden (intern.debiterade_min), och ett pass
  -- Nextrum undantagit kostar ingenting.
  select case
           when not coalesce(b.fakturerbar, true) then 0
           when b.klippkort_id is not null or intern.timbank_betalt(b.id) then 0
           else greatest(round((coalesce(nullif(b.timpris_ore, 0), t.pris_per_timme_ore, 0)
                                + case when coalesce(b.antal_barn, 1) > 1
                                       then coalesce(b.extra_ore, t.extra_personer_ore, 0) else 0 end)
                               * coalesce(p_minuter, 0) / 60.0)
                         - coalesce(b.rabatt_ore, 0), 0)::integer
         end
    from (select 1) x
    left join public.tjanster t on t.kod = b.tjanst
$function$;

create or replace function intern.familjen_har_avbokningsregeln(p_familj uuid, p_fore timestamptz)
 returns boolean
 language sql
 stable
 set search_path to ''
as $function$
  -- sen_avbokning (2026-10-22). Regeln står i användarvillkoren från
  -- versionen 2026-10-23. Den gäller ett pass som föreslogs efter att
  -- familjen godkänt den versionen eller en senare, aldrig ett som bokades
  -- på de gamla villkoren.
  select exists (select 1 from public.villkor_godkannanden g
                  where g.anvandare = p_familj and g.version >= '2026-10-23'
                    and g.godkant_at <= coalesce(p_fore, now()))
$function$;

-- Databasens egna: bara stampla_avbokningen och syskontillägget anropar dem,
-- och de kör som ägaren.
revoke all on function intern.avbokningen_ar_sen(timestamptz, timestamptz) from public, anon, authenticated, service_role;
revoke all on function intern.sen_avbokningens_minuter(integer) from public, anon, authenticated, service_role;
revoke all on function intern.sen_avbokningens_pris(public.bookings, integer) from public, anon, authenticated, service_role;
revoke all on function intern.familjen_har_avbokningsregeln(uuid, timestamptz) from public, anon, authenticated, service_role;

-- ---------- 4. funktionerna som räknar ett sent avbokat pass ----------
-- public.stampla_avbokningen()
CREATE OR REPLACE FUNCTION public.stampla_avbokningen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- sen_avbokning (2026-10-22, Leo: "minst 12h innan måste det avbokas, avbokas det
-- inom 12h av att lektionen ska hållas betalas 50% av belopp, eller spenderas
-- hälften av planerade timmar för lektionen"). Avgiften räknas här, i samma
-- skrivning som avbokningen, och ingen annan väg sätter den.
declare
  grans integer;
begin
  if tg_op = 'INSERT' then
    /* Ett nytt pass från en vy bär inga stämplar och inget svar. En
       stämpel en familj kunnat skicka med hade varit en avbokning som
       aldrig skett. Som postgres eller admin står raden som den är. */
    if auth.uid() is not null and not public.is_admin() then
      new.avbokad_at := null;
      new.avbokad_av := null;
      new.avbokad_fran := null;
      new.motforslag_at := null;
      new.svar_meddelande := null;
    end if;
    -- sen_avbokning: ett nytt pass har ingen avgift, vem som än skriver det.
    new.sen_avbokning_minuter := null;
    new.sen_avbokning_ore := null;
    new.avbokad_for_familjen := false;
    return new;
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.avbokad_at := now();
    new.avbokad_av := auth.uid();   -- null när fakturering eller ett schema avbokar
    new.avbokad_fran := case when old.status in ('requested', 'confirmed', 'completed') then old.status end;

    /* SEN AVBOKNING. Familjen avbokar ett bokat pass (bekräftat av båda)
       mindre än gränsen före start, och passet räknas som hållet i halva
       den bokade tiden (intern.sen_avbokningens_minuter). Var det betalt
       med timmar dras den tiden ur dem, som för ett pass som blev kortare
       (intern.debiterade_min läser minuterna); annars är avgiften priset
       för den tiden (intern.sen_avbokningens_pris), betalt med Betala nu
       eller draget från det familjen redan betalat. Ett betalt pass
       avbokar Nextrum åt familjen (skydda_bokningsfalt), och säger då att
       det var familjens begäran (avbokad_for_familjen, bara admin). Ett
       förslag, studiehjälparens avbokning och vår egen kostar ingenting,
       och inte heller ett pass som föreslogs innan familjen godkänt
       villkoren med regeln. */
    if not public.is_admin() then
      new.avbokad_for_familjen := false;
    end if;
    new.sen_avbokning_minuter := null;
    new.sen_avbokning_ore := null;
    if old.status = 'confirmed'
       and ((auth.uid() is not null and auth.uid() = old.parent_id) or new.avbokad_for_familjen)
       and intern.avbokningen_ar_sen(intern.passets_start(old.wanted_date, old.wanted_time), now())
       and intern.familjen_har_avbokningsregeln(old.parent_id, old.created_at) then
      new.sen_avbokning_minuter := intern.sen_avbokningens_minuter(old.duration_min);
      new.sen_avbokning_ore := intern.sen_avbokningens_pris(new, new.sen_avbokning_minuter);
    end if;
    return new;
  end if;

  /* Ett avbokat pass som blir något annat igen (bara admin och databasen
     kan det) bär ingen avgift. */
  if old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    new.sen_avbokning_minuter := null;
    new.sen_avbokning_ore := null;
    new.avbokad_for_familjen := false;
  elsif new.status = 'cancelled'
        and (new.sen_avbokning_minuter, new.sen_avbokning_ore, new.avbokad_for_familjen)
            is distinct from (old.sen_avbokning_minuter, old.sen_avbokning_ore, old.avbokad_for_familjen) then
    /* Efteråt kan avgiften bara efterskänkas, av Nextrum: båda blir null,
       och inget annat. Ett belopp sätts bara när passet avbokas. */
    if not ((public.is_admin() or auth.uid() is null)
            and new.sen_avbokning_minuter is null and new.sen_avbokning_ore is null
            and new.avbokad_for_familjen is not distinct from old.avbokad_for_familjen) then
      raise exception using errcode = '42501',
        message = 'Avgiften för en sen avbokning räknas när passet avbokas. Efteråt kan Nextrum bara efterskänka den.';
    end if;
    /* Var passet betalt med timmar var timmarna betalningen: de kommer
       tillbaka, som vid en avbokning i tid (klippkortspass_avbokat). */
    if old.sen_avbokning_minuter is not null
       and (new.klippkort_id is not null or intern.timbank_betalt(new.id))
       and new.betalning_status = 'betald'
       and coalesce(new.betalt_ore, 0) = 0
       and new.stripe_payment_intent_id is null then
      new.betalning_status := 'ingen';
      new.betald_at := null;
    end if;
  end if;

  if new.wanted_date is distinct from old.wanted_date
     or new.wanted_time is distinct from old.wanted_time then
    /* sen_avbokning: inom gränsen flyttar familjen inte ett bokat pass.
       Att flytta det och sedan dra tillbaka förslaget hade varit en sen
       avbokning utan avgift (samma hål som syskontillägget stängde
       2026-10-21, bookings_syskon_star_fast). Studiehjälparen och Nextrum
       kan flytta det, och ett pass som bokades på de gamla villkoren
       flyttar familjen som förut: där kostar en avbokning inget. */
    if old.status = 'confirmed' and new.status = 'requested'
       and auth.uid() is not null and auth.uid() = old.parent_id
       and intern.avbokningen_ar_sen(intern.passets_start(old.wanted_date, old.wanted_time), now())
       and intern.familjen_har_avbokningsregeln(old.parent_id, old.created_at) then
      select i.avbokning_avgift_timmar into grans from public.betalning_installning i where i.id = 1;
      raise exception using errcode = '23514',
        message = format('Passet börjar om mindre än %s timmar och flyttas inte nu. Avboka det, så räknas det '
                         || 'som en sen avbokning, eller skriv till er studiehjälpare.', grans);
    end if;

    if old.status = 'requested' and new.status = 'requested'
       and new.created_by is distinct from old.created_by
       and old.created_by in (old.parent_id, old.tutor_id)
       and new.created_by in (new.parent_id, new.tutor_id) then
      -- Den som fick förslaget svarade med en annan tid.
      new.motforslag_at := now();
    elsif old.status = 'requested' and new.created_by is not distinct from old.created_by then
      -- Samma part ändrar sitt eget förslag: ett motförslag är det fortfarande.
      null;
    else
      /* Ett bekräftat pass som flyttas är ett nytt förslag, och ett
         gammalt svar hör till en tid som inte gäller längre. */
      new.motforslag_at := null;
      new.svar_meddelande := null;
    end if;
  end if;

  return new;
end $function$;

-- public.klippkortspass_avbokat()
CREATE OR REPLACE FUNCTION public.klippkortspass_avbokat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  /* Fas 21.1: gäller alla, inte bara admin. Triggern körs efter
     skydda_bokningsfalt, så det här är aldrig vad spärren prövar. */
  /* sen_avbokning (2026-10-22): en sen avbokning lämnar passet betalt med
     timmarna, för hälften av tiden räknas som hållen (stampla_avbokningen). */
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.sen_avbokning_minuter is null
     and (new.klippkort_id is not null or intern.timbank_betalt(new.id)) -- Fas 22.1
     and new.betalning_status = 'betald'
     and coalesce(new.betalt_ore, 0) = 0
     and new.stripe_payment_intent_id is null then
    new.betalning_status := 'ingen';
    new.betald_at := null;
  end if;
  return new;
end $function$;

-- intern.debiterade_min(uuid)
CREATE OR REPLACE FUNCTION intern.debiterade_min(p_booking uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- sen_avbokning (2026-10-22): ett pass familjen avbokat sent räknas som
  -- hållet i halva den bokade tiden, och då är det tiden som dras.
  select coalesce(
    (select r.debiterade_min
       from public.lesson_reports r
      where r.booking_id = p_booking and r.start_tid is not null
      order by r.created_at
      limit 1),
    (select b.sen_avbokning_minuter from public.bookings b
      where b.id = p_booking and b.status = 'cancelled'))
$function$;

-- intern.kortets_anvanda(uuid,uuid)
CREATE OR REPLACE FUNCTION intern.kortets_anvanda(p_kort uuid, p_utom uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(case when x.forsta_klippkort_id = p_kort
                           then least(x.forsta_klippkort_timmar, d.a)
                           else greatest(d.a - coalesce(x.forsta_klippkort_timmar, 0), 0) end), 0)::int
    from public.bookings x
    cross join lateral (select intern.passets_korttimmar(x) as a) d
   where (x.klippkort_id = p_kort or x.forsta_klippkort_id = p_kort)
     and x.klippkort_id is not null
     -- sen_avbokning (2026-10-22): halva tiden av ett sent avbokat pass är använd.
     and (x.status <> 'cancelled' or x.sen_avbokning_minuter is not null)
     and x.id is distinct from p_utom
$function$;

-- intern.timbank_in(public.bookings)
CREATE OR REPLACE FUNCTION intern.timbank_in(b bookings)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case
           -- sen_avbokning (2026-10-22): ett sent avbokat pass sparar det som blev
           -- över av halva tiden, som ett pass som blev kortare.
           when (b.status is distinct from 'completed'
                 and not (b.status = 'cancelled' and b.sen_avbokning_minuter is not null))
             or b.betalning_status not in ('betald', 'tvist') then 0
           when b.klippkort_id is not null then
             case
               -- timmarna_delas (2026-10-14): timmen på köpet täckte hela passet.
               when t.a <= 0 then 0
               -- Gratistimmar (2026-10-13) sparar inget: sparade minuter
               -- betalas tillbaka i kronor när familjen slutar, och en gåva
               -- hade då blivit pengar. Det som blir över är den sista
               -- timmen, och den kom från första kortet om passet inte drog
               -- längre än så.
               when intern.ar_gratistimmar(case when t.a <= coalesce(b.forsta_klippkort_timmar, 0)
                                                then b.forsta_klippkort_id else b.klippkort_id end) then 0
               else greatest(1, ceil(h.hallet / 60.0))::int * 60 - h.hallet
             end
           when exists (select 1 from public.timbank_uttag u
                         where u.booking_id = b.id and u.sort = 'pass')
             then coalesce(b.duration_min, 60) - h.hallet
           else 0
         end
    from (select least(coalesce(b.duration_min, 60),
                       coalesce(intern.debiterade_min(b.id), b.duration_min, 60)) as hallet) h
    cross join lateral (select greatest(greatest(1, ceil(h.hallet / 60.0))::int
                                        - case when b.startrabatt then 1 else 0 end, 0) as a) t
$function$;

-- intern.timbank_saldo(uuid)
CREATE OR REPLACE FUNCTION intern.timbank_saldo(p_foralder uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (auth.uid() is null or auth.uid() = p_foralder or public.is_admin()
          or exists (select 1 from public.bookings x
                      where x.parent_id = p_foralder and x.tutor_id = auth.uid())) then
    return null;
  end if;
  return coalesce((select sum(intern.timbank_in(b))
                     from public.bookings b
                    where b.parent_id = p_foralder
                      -- sen_avbokning (2026-10-22): också ett sent avbokat pass.
                      and (b.status = 'completed'
                           or (b.status = 'cancelled' and b.sen_avbokning_minuter is not null))), 0)::int
       - coalesce((select sum(u.minuter)
                     from public.timbank_uttag u
                     left join public.bookings b on b.id = u.booking_id
                    where u.parent_id = p_foralder
                      and (u.booking_id is null or b.status is distinct from 'cancelled'
                           or b.sen_avbokning_minuter is not null)), 0)::int;
end $function$;

-- intern.tipstimmar_anvanda(uuid)
CREATE OR REPLACE FUNCTION intern.tipstimmar_anvanda(p_familj uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer
    from public.bookings b
   where b.parent_id = p_familj and b.rabattkod = 'TIPS'
     -- sen_avbokning (2026-10-22): halva tiden av ett sent avbokat pass är hållen.
     and (b.status <> 'cancelled' or b.sen_avbokning_minuter is not null)
$function$;

-- intern.tipstimmar_oanvanda(uuid)
CREATE OR REPLACE FUNCTION intern.tipstimmar_oanvanda(p_familj uuid)
 RETURNS SETOF date
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  intjanade date[];
  tagen     boolean[];
  pass      record;
  i         integer;
  n         integer;
  hittad    boolean;
begin
  select coalesce(array_agg(h.dag order by h.dag), '{}'::date[]) into intjanade
    from public.tipskoder k
    cross join lateral intern.tipsade_familjer(k.kod) t
    cross join lateral (select intern.tva_timmar_hallna(t.kund_id) as dag) h
    left join public.flaggor f on f.kod = 'tipstimme'
   where k.person_id = p_familj and k.sort = 'familj' and h.dag is not null
     and (coalesce(f.aktiv, false)
          or h.dag < (f.uppdaterad at time zone 'Europe/Stockholm')::date);
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

-- intern.forsta_timmen_tagen(uuid)
CREATE OR REPLACE FUNCTION intern.forsta_timmen_tagen(p_familj uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from public.bookings b
                  where b.parent_id = p_familj and b.startrabatt
                    -- sen_avbokning (2026-10-22): halva tiden av ett sent avbokat pass är hållen.
                    and (b.status <> 'cancelled' or b.sen_avbokning_minuter is not null)
                    and b.rabattkod is distinct from 'TIPS')
      or exists (select 1 from public.klippkort k
                  where k.parent_id = p_familj and k.forsta_timmen)
$function$;

-- public.forsta_timmen_lage(uuid)
CREATE OR REPLACE FUNCTION public.forsta_timmen_lage(p_familj uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  vem uuid := coalesce(p_familj, auth.uid());
begin
  if vem is null or (vem is distinct from auth.uid() and not public.is_admin()
                     and not public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera'])) then
    raise exception 'Bara familjen och admin ser det här.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'beviljad', exists (select 1 from public.forsta_timmen_beviljad v where v.parent_id = vem),
    'beviljad_at', (select v.beviljad_at from public.forsta_timmen_beviljad v where v.parent_id = vem),
    -- gratistimmarna_60_dagar: sista dagen för timmen pass för pass.
    'beviljad_till', (select (v.beviljad_at at time zone 'Europe/Stockholm')::date + 60
                        from public.forsta_timmen_beviljad v where v.parent_id = vem),
    'tagen', intern.forsta_timmen_tagen(vem),
    'i_planen', exists (select 1 from public.klippkort k where k.parent_id = vem and k.forsta_timmen),
    'plan_id', (select k.id from public.klippkort k where k.parent_id = vem and k.forsta_timmen
                 order by k.betald_at limit 1),
    'pa_pass', exists (select 1 from public.bookings b
                        where b.parent_id = vem and b.startrabatt
                          -- sen_avbokning (2026-10-22): som intern.forsta_timmen_tagen.
                          and (b.status <> 'cancelled' or b.sen_avbokning_minuter is not null)
                          and b.rabattkod is distinct from 'TIPS'));
end $function$;

-- public.avvikelser_rader()
CREATE OR REPLACE FUNCTION public.avvikelser_rader()
 RETURNS TABLE(typ text, objekt_tabell text, objekt_id text, datum date, belopp_ore bigint, kund_id uuid, studiehjalpare_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- fakturan_tas_bort (2026-10-21): inga fakturalarm och inga RUT-larm. RUT
-- drogs bara på fakturan.
declare
  manad    date := date_trunc('month', now() at time zone 'Europe/Stockholm')::date;
begin
  return query
  -- Genomfört pass utan rapport: räknas inte och betalas inte ut.
  select 'pass_utan_rapport', 'bookings', p.id::text, p.wanted_date, null::bigint, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and not p.har_rapport and not p.pa_underlag
  union all
  -- Rapport som inte hör till något pass.
  select 'fristaende_rapport', 'lesson_reports', r.id::text, r.lesson_date, null, null, r.tutor_id
    from public.lesson_reports r where r.booking_id is null
  -- Hölls och rapporterades, men familjen har inte betalat (Fas 14.2).
  -- Ingen datumgräns: det finns ingen dag då ett obetalt pass blir
  -- betalt av sig självt.
  union all
  select 'ej_betalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.har_rapport
     and p.betalning_status in ('ingen', 'vantar', 'misslyckad')
     -- Fas 19.5: ett pass där rabatten täcker hela priset (första timmen
     -- bjuds) har ingenting att betala.
     and not (p.timpris_ore is not null
              and coalesce(p.rabatt_ore, 0) >= round((p.timpris_ore
                    + case when coalesce(p.antal_barn, 1) > 1 then coalesce(p.extra_ore, 0) else 0 end)
                    * (coalesce(p.debiterade_min, p.duration_min, 60) - coalesce(p.timbank_min, 0)) / 60.0))
  union all
  -- FAS 20.1. Betalt, drog över, tillägget obetalt.
  select 'tillagg_obetalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.betalning_status = 'betald'
     and p.debiterade_min > p.betalda_min
     -- Fas 20.4: ett återbetalt tillägg är ett beslut, inte en skuld.
     and not exists (select 1 from public.pass_tillagg t
                      where t.booking_id = p.id and t.status = 'aterbetald')
  union all
  -- FAS 20.1. Betalt med kort för mer tid än passet höll.
  select 'betalt_for_lange', 'bookings', x.id::text, x.wanted_date, x.kvar, x.parent_id, x.tutor_id
    from (
      select p.id, p.wanted_date, p.parent_id, p.tutor_id,
             (b.betalt_ore - coalesce(b.aterbetald_ore, 0)
              - greatest(round((p.timpris_ore
                                + case when coalesce(p.antal_barn, 1) > 1 then coalesce(p.extra_ore, 0) else 0 end)
                               * p.debiterade_min / 60.0)
                         - coalesce(p.rabatt_ore, 0), 0))::bigint as kvar
        from public.passunderlag p
        join public.bookings b on b.id = p.id
       where p.betalning_status = 'betald' and b.klippkort_id is null and b.betalt_ore is not null
         and p.timpris_ore is not null
         and p.debiterade_min < coalesce(b.stripe_minuter, b.duration_min)
    ) x
   where x.kvar > 0
  union all
  -- Avbokat men betalt (Fas 14.2c). Beloppet är det som inte gått
  -- tillbaka än. Saknas betalt_ore på en betald rad är det också fel,
  -- och då larmar raden utan belopp i stället för att tiga.
  -- sen_avbokning (2026-10-22): avgiften för en sen avbokning går inte
  -- tillbaka, och ett pass som timmarna betalade har inga pengar att ge
  -- tillbaka (de använda timmarna är avgiften).
  select 'betald_men_avbokad', 'bookings', b.id::text, b.wanted_date,
         (b.betalt_ore - coalesce(b.aterbetald_ore, 0) - coalesce(b.sen_avbokning_ore, 0))::bigint,
         b.parent_id, b.tutor_id
    from public.bookings b
   where b.status = 'cancelled' and b.betalning_status = 'betald'
     and (b.betalt_ore is null
          or b.betalt_ore > coalesce(b.aterbetald_ore, 0) + coalesce(b.sen_avbokning_ore, 0))
     and not (b.sen_avbokning_minuter is not null and coalesce(b.betalt_ore, 0) = 0
              and b.stripe_payment_intent_id is null)
  union all
  -- sen_avbokning (2026-10-22): familjen avbokade sent och har inte betalat
  -- avgiften. Den står under Att betala i familjens vy, och vi följer upp den.
  select 'sen_avbokning_obetald', 'bookings', b.id::text, b.wanted_date,
         b.sen_avbokning_ore::bigint, b.parent_id, b.tutor_id
    from public.bookings b
   where b.status = 'cancelled' and coalesce(b.sen_avbokning_ore, 0) > 0
     and b.fakturerbar
     and b.betalning_status in ('ingen', 'vantar', 'misslyckad')
  union all
  select 'ej_utbetalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.har_rapport and not p.pa_underlag and p.tutor_id is not null
     and p.wanted_date < manad
  union all
  -- Utbetalning som inte gjorts, för en månad före förra.
  select 'utbetalning_vantar', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u
   where u.status in ('utkast', 'godkand')
     and u.period < (manad - interval '1 month')::date
  union all
  select 'utbetalning_misslyckad', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u where u.status = 'misslyckad'
  union all
  -- Pass klart för utbetalning men ingen ersättning att räkna med.
  select 'timpenning_saknas', 'bookings', b.id::text, b.wanted_date, null, b.parent_id, b.tutor_id
    from public.passunderlag b
    left join public.tutor_profiles tp on tp.id = b.tutor_id
    left join public.tjanster t on t.kod = b.tjanst
   where b.tutor_id is not null and b.fakturerbar and b.har_rapport and not b.pa_underlag
     and coalesce(tp.hourly_rate, 0) = 0 and coalesce(t.ersattning_per_timme_ore, 0) = 0
  union all
  select 'pass_utan_studiehjalpare', 'bookings', b.id::text, b.wanted_date, null, b.parent_id, null
    from public.bookings b where b.status = 'completed' and b.tutor_id is null
  union all
  select 'utbetalning_summa_fel', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u
   where u.belopp_ore <> coalesce((select sum(l.belopp_ore) from public.payout_lines l where l.payout_id = u.id), 0);
end $function$;

-- public.kontroll_ekonomiska_avvikelser()
CREATE OR REPLACE FUNCTION public.kontroll_ekonomiska_avvikelser()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- fakturan_tas_bort (2026-10-21): inga texter för fakturan och RUT.
declare
  n integer := 0;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  a record;
  rubrik text;
  text_ text;
  tabell text;
begin
  for a in select * from public.avvikelser_rader()
            where typ <> 'pass_utan_rapport'
  loop
    select t.rubrik, t.beskrivning into rubrik, text_ from (values
      ('fristaende_rapport',      'Rapport utan pass',        'Rapporten hör inte till något pass och kan därför varken räknas eller betalas ut. Koppla den till rätt pass.'),
      ('ej_betalt',               'Inte betalt',              'Passet hölls och rapporterades, men familjen har inte betalat det. Betala-knappen ligger kvar på passet i familjens vy.'),
      ('betald_men_avbokad',      'Betalt men avbokat',       'Passet är avbokat men familjen har betalat det. Villkoren lovar beloppet tillbaka för ett pass som aldrig hölls, utom avgiften för en sen avbokning: återbetala det som står här under Betalningar.'),
      ('sen_avbokning_obetald',   'Sen avbokning obetald',    'Familjen avbokade passet mindre än 12 timmar före start, och avgiften (hälften av passet) är inte betald. Den står under Att betala i familjens vy.'),
      ('ej_utbetalt',             'Inte utbetalt',            'Klart för underlag, men månaden det hölls är slut.'),
      ('utbetalning_vantar',      'Utbetalning väntar',       'Underlaget är äldre än förra månaden och pengarna har inte gått iväg.'),
      ('utbetalning_misslyckad',  'Utbetalning misslyckades', 'Överföringen gick inte igenom. Ta reda på varför innan nästa körning.'),
      ('timpenning_saknas',       'Timpenning saknas',        'Passet kan inte betalas ut: varken studiehjälparen eller tjänsten har en ersättning.'),
      ('pass_utan_studiehjalpare','Pass utan studiehjälpare', 'Passet är genomfört men ingen studiehjälpare står på det.'),
      ('utbetalning_summa_fel',   'Utbetalningssumman stämmer inte','Underlagets belopp är inte summan av dess rader.')
    ) as t(typ, rubrik, beskrivning) where t.typ = a.typ;

    tabell := a.objekt_tabell;

    if public.skapa_uppgift(
         coalesce(rubrik, a.typ) || case when a.datum is not null
                                    then ' ' || to_char(a.datum, 'YYYY-MM-DD') else '' end,
         'avvikelse:' || a.typ || ':' || a.objekt_tabell || ':' || a.objekt_id,
         'problem',
         text_,
         tabell,
         a.objekt_id,
         idag + 5) is not null
    then n := n + 1;
    end if;
  end loop;
  return n;
end $function$;

-- intern.passet_betalt_ej_hallet(public.bookings)
CREATE OR REPLACE FUNCTION intern.passet_betalt_ej_hallet(b bookings)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select b.status <> 'completed'
     and b.betalning_status in ('betald', 'tvist')
     and not (coalesce(b.betalt_ore, 0) > 0 and coalesce(b.aterbetald_ore, 0) >= b.betalt_ore)
     -- sen_avbokning (2026-10-22): avgiften är det passet kostade, och det enda
     -- som ska tillbaka är resten.
     and not (b.status = 'cancelled' and b.sen_avbokning_minuter is not null
              and coalesce(b.aterbetald_ore, 0) + coalesce(b.sen_avbokning_ore, 0) >= coalesce(b.betalt_ore, 0))
$function$;

-- intern.radering_underlag(text,uuid)
CREATE OR REPLACE FUNCTION intern.radering_underlag(p_typ text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
-- fakturan_tas_bort (2026-10-21)
declare
  idag   date := (now() at time zone 'Europe/Stockholm')::date;
  p      public.profiles;
  s      public.students;
  hinder jsonb[] := '{}';
  larm   jsonb := '[]';
  tas    jsonb := '{}';
  kvar   jsonb := '{}';
  satt   text := 'helt';
  avbok  bigint := 0;
  barn   uuid[];
  pass   uuid[];
  nyckel text := intern.radering_nyckel(p_typ, p_id);
  n      bigint;
  m      bigint;
begin
  if p_typ is null or p_typ not in ('anmalan', 'ansokan', 'kontakt', 'familj', 'elev', 'studiehjalpare') then
    return jsonb_build_object('fel', 'Okänd sort: ' || coalesce(p_typ, 'ingen') || '.');
  end if;

  -- ---------- intresseanmälan ----------
  if p_typ = 'anmalan' then
    if not exists (select 1 from public.leads l where l.id = p_id and l.email <> 'gallrad') then
      return jsonb_build_object('fel', 'Anmälan finns inte, eller är redan avidentifierad.');
    end if;
    satt := 'avidentifieras';
    tas := jsonb_build_object(
      'anmalningar', (select count(*) from intern.radering_anmalningar(p_typ, p_id)),
      'kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)));
    kvar := jsonb_build_object('konto',
      exists (select 1 from public.leads l join public.profiles k on k.id = l.kund_id
               where l.id = p_id and k.raderad_at is null));

  -- ---------- ansökan ----------
  elsif p_typ = 'ansokan' then
    if not exists (select 1 from public.applications a where a.id = p_id) then
      return jsonb_build_object('fel', 'Ansökan finns inte längre.');
    end if;
    tas := jsonb_build_object(
      'ansokningar', (select count(*) from intern.radering_ansokningar(p_typ, p_id)),
      'kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)));
    kvar := jsonb_build_object('konto',
      exists (select 1 from public.profiles k
               where k.role = 'tutor' and k.raderad_at is null
                 and nyckel is not null and intern.epost_nyckel(k.email) = nyckel));

  -- ---------- kontaktmeddelande ----------
  elsif p_typ = 'kontakt' then
    if not exists (select 1 from public.contact_messages c where c.id = p_id) then
      return jsonb_build_object('fel', 'Meddelandet finns inte längre.');
    end if;
    tas := jsonb_build_object('kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)));

  -- ---------- familj ----------
  elsif p_typ = 'familj' then
    select * into p from public.profiles where id = p_id;
    if not found then
      return jsonb_build_object('fel', 'Kontot finns inte längre.');
    elsif intern.har_adminroll(p.id) then
      return jsonb_build_object('fel', 'Ett adminkonto raderas inte här.');
    elsif p.role <> 'parent' then
      return jsonb_build_object('fel', 'Kontot är inte en familj.');
    elsif p.raderad_at is not null then
      return jsonb_build_object('fel', 'Kontot är redan raderat.');
    end if;

    select coalesce(array_agg(x.id), '{}') into barn from public.students x where x.parent_id = p_id;
    select coalesce(array_agg(x.id), '{}') into pass from public.bookings x where x.parent_id = p_id;

    -- sen_avbokning (2026-10-22): avgiften för en sen avbokning går inte tillbaka.
    select count(*), coalesce(sum(greatest(coalesce(b.betalt_ore, 0) - coalesce(b.aterbetald_ore, 0)
                                           - coalesce(b.sen_avbokning_ore, 0), 0)), 0)
      into n, m from public.bookings b where b.parent_id = p_id and intern.passet_betalt_ej_hallet(b);
    hinder := hinder || intern.radering_rad('betalt_ej_hallet', n, m);

    select count(*), coalesce(sum(case when k.angerfrist_till >= idag then k.vid_anger_ore
                                       else k.vid_uppsagning_ore end), 0)
      into n, m
      from public.klippkort_saldo k
     where k.parent_id = p_id and k.status = 'betald' and k.giltigt_till >= idag
       and (case when k.angerfrist_till >= idag then k.vid_anger_ore else k.vid_uppsagning_ore end) > 0;
    hinder := hinder || intern.radering_rad('timmar_kvar', n, m);

    n := coalesce(intern.timbank_saldo(p_id), 0);
    if n > 0 then
      hinder := hinder || intern.radering_rad('timbank_kvar', 1, intern.timbank_varde(p_id, n::int)::bigint, n);
    end if;

    select count(*) into n from public.klippkort k
     where k.parent_id = p_id and k.status = 'vantar' and k.created_at > now() - interval '24 hours';
    hinder := hinder || intern.radering_rad('kassa_oppen', n);

    -- kortet_reserveras: ett sparat kort och en reservation tas bort
    -- först, så att inget blir kvar hos Stripe.
    select count(*) into n from public.sparade_kort k where k.parent_id = p_id;
    hinder := hinder || intern.radering_rad('kort_sparat', n);
    select count(*), coalesce(sum(r.reserverat_ore), 0) into n, m from public.kortreservationer r
     where r.parent_id = p_id and r.lage in ('reserverad', 'slapps');
    hinder := hinder || intern.radering_rad('kort_reserverat', n, m);

    select count(*) into n from public.stripe_tvister t
     where t.booking_id = any (pass) and t.stangd is null;
    hinder := hinder || intern.radering_rad('tvist_oppen', n);

    select count(*), coalesce(sum(a.belopp_ore), 0)::bigint into n, m
      from public.avvikelser_rader() a where a.kund_id = p_id and a.typ = 'betalt_for_lange';
    hinder := hinder || intern.radering_rad('betalt_for_lange', n, m);

    -- syskontillagg_som_skuld (2026-10-21): obetalt syskontillägg skrivs av eller betalas först.
    select count(*), coalesce(sum(t.belopp_ore), 0) into n, m from public.tillagg_poster t
     where t.familj_id = p_id and t.status in ('upplupen', 'i_betalning');
    hinder := hinder || intern.radering_rad('tillagg_obetalt', n, m);

    select count(*) into n from public.bookings b
     where b.parent_id = p_id and b.status = 'confirmed' and intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('ej_rapporterat', n);

    select coalesce(jsonb_agg(x.rad order by x.typ), '[]') into larm
      from (select a.typ, intern.radering_rad(a.typ, count(*), sum(a.belopp_ore)::bigint) as rad
              from public.avvikelser_rader() a
             where a.kund_id = p_id and a.typ not in ('betalt_for_lange', 'betald_men_avbokad')
             group by a.typ) x;

    if exists (select 1 from public.klippkort k where k.parent_id = p_id)
       -- betalningsliggaren (2026-10-21): raden raderas aldrig, och nyckeln är restrict.
       or exists (select 1 from public.betalningar x where x.familj = p_id)
       -- syskontillagg_som_skuld (2026-10-21): posten raderas aldrig.
       or exists (select 1 from public.tillagg_poster t where t.familj_id = p_id)
       or exists (select 1 from public.timbank_uttag u where u.parent_id = p_id)
       or exists (select 1 from public.lesson_reports r where r.student_id = any (barn))
       or exists (select 1 from public.bookings b where b.parent_id = p_id and intern.passet_bar_bokforing(b)) then
      satt := 'avidentifieras';
    end if;

    select count(*) into avbok from public.bookings b
     where b.parent_id = p_id and b.status in ('requested', 'confirmed')
       and not intern.passet_har_borjat(b) and not intern.passet_betalt_ej_hallet(b);

    -- Försöken på de digitala uppgifterna, när tabellen finns (Fas 23.1).
    n := 0;
    if to_regclass('public.niva_forsok') is not null then
      execute 'select count(*) from public.niva_forsok where student_id = any ($1)' into n using barn;
    end if;
    tas := jsonb_build_object(
      'forsok', n,
      'barn', (select count(*) from public.students x where x.parent_id = p_id and x.raderad_at is null),
      'meddelanden', (select count(*) from public.messages x where x.parent_id = p_id),
      'anmalningar', (select count(*) from intern.radering_anmalningar(p_typ, p_id)),
      'kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)),
      'anteckningar', (select count(*) from public.admin_noteringar x where x.om_profil = p_id));
    if satt = 'avidentifieras' then
      kvar := jsonb_build_object(
        'pass', (select count(*) from public.bookings b where b.parent_id = p_id and intern.passet_bar_bokforing(b)),
        'rapporter', (select count(*) from public.lesson_reports r where r.student_id = any (barn)),
        'klippkort', (select count(*) from public.klippkort k where k.parent_id = p_id));
    end if;
    -- Avtalen med familjen (dokument_delas_med_personen) står kvar
    -- under System → Dokument, som studiehjälparens.
    kvar := kvar || jsonb_build_object(
      'handlingar', (select count(*) from public.handlingar h
                      where h.kopplad_tabell = 'profiles' and h.kopplad_id = p_id::text));

  -- ---------- studiehjälpare ----------
  elsif p_typ = 'studiehjalpare' then
    select * into p from public.profiles where id = p_id;
    if not found then
      return jsonb_build_object('fel', 'Kontot finns inte längre.');
    elsif intern.har_adminroll(p.id) then
      return jsonb_build_object('fel', 'Ett adminkonto raderas inte här.');
    elsif p.role <> 'tutor' then
      return jsonb_build_object('fel', 'Kontot är inte en studiehjälpare.');
    elsif p.raderad_at is not null then
      return jsonb_build_object('fel', 'Kontot är redan raderat.');
    end if;

    select count(*) into n from public.students x
     where x.matched_tutor_id = p_id and x.match_status <> 'pending';
    hinder := hinder || intern.radering_rad('matchade_elever', n);

    select count(*) into n from public.bookings b
     where b.tutor_id = p_id and b.status = 'confirmed' and intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('ej_rapporterat', n);

    select count(*), coalesce(sum(b.betalt_ore - coalesce(b.aterbetald_ore, 0)), 0) into n, m
      from public.bookings b
     where b.tutor_id = p_id and b.status in ('requested', 'confirmed') and not intern.passet_har_borjat(b)
       and b.betalning_status in ('betald', 'tvist')
       and coalesce(b.betalt_ore, 0) > coalesce(b.aterbetald_ore, 0);
    hinder := hinder || intern.radering_rad('kommande_betalda', n, m);

    -- Bonusen för tips (2026-10-13) är lön som inte är betald än.
    select count(*), coalesce(sum(t.belopp_ore), 0) into n, m from public.tipsbonus t
     where t.studiehjalpare_id = p_id and t.status in ('utkast', 'godkand');
    hinder := hinder || intern.radering_rad('tipsbonus', n, m);

    -- varvningsbonus (2026-10-21): en intjänad bonus som inte är utbetald.
    select count(*), coalesce(sum(t.brutto_ore), 0) into n, m from public.varvningsbonus t
     where t.varvare_profil_id = p_id and t.status = 'intjanad';
    hinder := hinder || intern.radering_rad('varvningsbonus', n, m);

    select coalesce(jsonb_agg(x.rad order by x.typ), '[]') into larm
      from (select a.typ, intern.radering_rad(a.typ, count(*), sum(a.belopp_ore)::bigint) as rad
              from public.avvikelser_rader() a
             where a.studiehjalpare_id = p_id
             group by a.typ) x;

    if exists (select 1 from public.lesson_reports r where r.tutor_id = p_id)
       or exists (select 1 from public.payouts u where u.tutor_id = p_id)
       or exists (select 1 from public.tipsbonus t where t.studiehjalpare_id = p_id)
       -- varvningsbonus (2026-10-21): raden raderas aldrig.
       or exists (select 1 from public.varvningsbonus t where t.varvare_profil_id = p_id)
       or exists (select 1 from public.study_plans x where x.tutor_id = p_id)
       or exists (select 1 from public.homework x where x.tutor_id = p_id)
       or exists (select 1 from public.materials x where x.tutor_id = p_id)
       or exists (select 1 from public.progress_items x where x.tutor_id = p_id)
       or exists (select 1 from public.bookings b where b.tutor_id = p_id and intern.passet_bar_bokforing(b))
       -- profiles.matched_tutor_id har ingen ON DELETE. Står en familj
       -- kvar med hen, fast inget barn är matchat, hade borttagningen
       -- fallit på nyckeln.
       or exists (select 1 from public.profiles f where f.matched_tutor_id = p_id)
       -- Nycklarna till kontot sätts till null när det tas bort, och i en
       -- stängd månad nekar låset den ändringen.
       or exists (select 1 from public.bookings b
                   where (b.avbokad_av = p_id or b.created_by = p_id) and intern.manad_stangd(b.wanted_date)) then
      satt := 'avidentifieras';
    end if;

    select count(*) into avbok from public.bookings b
     where b.tutor_id = p_id and b.status in ('requested', 'confirmed') and not intern.passet_har_borjat(b);

    tas := jsonb_build_object(
      'meddelanden', (select count(*) from public.messages x where x.tutor_id = p_id),
      'ansokningar', (select count(*) from intern.radering_ansokningar(p_typ, p_id)),
      'kontaktmeddelanden', (select count(*) from intern.radering_kontakter(p_typ, p_id)),
      'anteckningar', (select count(*) from public.admin_noteringar x where x.om_profil = p_id));
    kvar := jsonb_build_object(
      'handlingar', (select count(*) from public.handlingar h
                      where h.kopplad_tabell = 'profiles' and h.kopplad_id = p_id::text));
    if satt = 'avidentifieras' then
      kvar := kvar || jsonb_build_object(
        'pass', (select count(*) from public.bookings b where b.tutor_id = p_id and intern.passet_bar_bokforing(b)),
        'rapporter', (select count(*) from public.lesson_reports r where r.tutor_id = p_id),
        'underlag', (select count(*) from public.payouts u where u.tutor_id = p_id),
        'tipsbonus', (select count(*) from public.tipsbonus t where t.studiehjalpare_id = p_id),
        'varvningsbonus', (select count(*) from public.varvningsbonus t where t.varvare_profil_id = p_id),
        'elevernas_material', (select count(*) from public.homework x where x.tutor_id = p_id)
                              + (select count(*) from public.study_plans x where x.tutor_id = p_id)
                              + (select count(*) from public.progress_items x where x.tutor_id = p_id)
                              + (select count(*) from public.materials x where x.tutor_id = p_id));
    end if;

  -- ---------- elev ----------
  else
    select * into s from public.students where id = p_id;
    if not found then
      return jsonb_build_object('fel', 'Eleven finns inte längre.');
    elsif s.raderad_at is not null then
      return jsonb_build_object('fel', 'Eleven är redan raderad.');
    end if;

    select coalesce(array_agg(x.id), '{}') into pass from public.bookings x where x.student_id = p_id;

    -- sen_avbokning (2026-10-22): avgiften för en sen avbokning går inte tillbaka.
    select count(*), coalesce(sum(greatest(coalesce(b.betalt_ore, 0) - coalesce(b.aterbetald_ore, 0)
                                           - coalesce(b.sen_avbokning_ore, 0), 0)), 0)
      into n, m from public.bookings b where b.student_id = p_id and intern.passet_betalt_ej_hallet(b);
    hinder := hinder || intern.radering_rad('betalt_ej_hallet', n, m);

    select count(*) into n from public.stripe_tvister t
     where t.booking_id = any (pass) and t.stangd is null;
    hinder := hinder || intern.radering_rad('tvist_oppen', n);

    select count(*) into n from public.bookings b
     where b.student_id = p_id and b.status = 'confirmed' and intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('ej_rapporterat', n);

    -- syskontillagg_som_skuld (granskningen 2026-10-21): barnet är med som
    -- syskon på ett kommande pass. Barnen på ett pass ändras inte, så passet
    -- avbokas först, och tillägget frigörs då.
    select count(*) into n from public.bookings b
     where p_id = any (b.extra_barn) and b.status in ('requested', 'confirmed') and not intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('syskon_kommande', n);

    select coalesce(jsonb_agg(x.rad order by x.typ), '[]') into larm
      from (select a.typ, intern.radering_rad(a.typ, count(*), sum(a.belopp_ore)::bigint) as rad
              from public.avvikelser_rader() a
             where a.objekt_tabell = 'bookings' and a.objekt_id in (select unnest(pass)::text)
             group by a.typ) x;

    if exists (select 1 from public.lesson_reports r where r.student_id = p_id)
       or exists (select 1 from public.bookings b where b.student_id = p_id and intern.passet_bar_bokforing(b)) then
      satt := 'avidentifieras';
    end if;

    select count(*) into avbok from public.bookings b
     where b.student_id = p_id and b.status in ('requested', 'confirmed')
       and not intern.passet_har_borjat(b) and not intern.passet_betalt_ej_hallet(b);

    n := 0;
    if to_regclass('public.niva_forsok') is not null then
      execute 'select count(*) from public.niva_forsok where student_id = $1' into n using p_id;
    end if;
    tas := jsonb_build_object(
      'forsok', n,
      'laxor', (select count(*) from public.homework x where x.student_id = p_id),
      'material', (select count(*) from public.materials x where x.student_id = p_id),
      'omraden', (select count(*) from public.progress_items x where x.student_id = p_id),
      'studieplaner', (select count(*) from public.study_plans x where x.student_id = p_id));
    if satt = 'avidentifieras' then
      kvar := jsonb_build_object(
        'pass', (select count(*) from public.bookings b where b.student_id = p_id and intern.passet_bar_bokforing(b)),
        'rapporter', (select count(*) from public.lesson_reports r where r.student_id = p_id));
    end if;
  end if;

  return jsonb_build_object(
    'typ', p_typ,
    'satt', satt,
    'hinder', to_jsonb(array_remove(hinder, null)),
    'larm', coalesce(larm, '[]'),
    'avbokas', avbok,
    'tas_bort', tas,
    'star_kvar', kvar,
    'filer', (select coalesce(jsonb_agg(jsonb_build_object('hink', f.hink, 'namn', f.namn)
                                        order by f.hink, f.namn), '[]')
                from intern.radering_filer(p_typ, p_id) f));
end $function$;

-- intern.bookings_syskon_foljer()
CREATE OR REPLACE FUNCTION intern.bookings_syskon_foljer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  p      public.tillagg_poster%rowtype;
  i      public.tillagg_installning%rowtype;
  ny     text;
  varfor text;
  halv   integer;
begin
  select * into p from public.tillagg_poster t where t.bokning_id = new.id for update;
  if not found then
    return null;
  end if;

  if p.status = 'bokad'
     and (new.wanted_date is distinct from old.wanted_date or new.wanted_time is distinct from old.wanted_time) then
    update public.tillagg_poster t set pass_start = intern.passets_start(new.wanted_date, new.wanted_time)
     where t.id = p.id;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'completed' and p.status = 'bokad' then
    ny := 'upplupen';
  elsif new.status = 'cancelled' and p.status = 'bokad' then
    /* sen_avbokning (2026-10-22): passet avgör om avbokningen var sen
       (stampla_avbokningen, också när Nextrum avbokade på familjens
       begäran), och då är hälften av tillägget en skuld, som hälften av
       passet: posten räknas på halva tiden. */
    if new.sen_avbokning_minuter is not null then
      select * into i from public.tillagg_installning where id = 1;
      if coalesce(i.debitera_vid_sen_avbokning, true) then
        halv := intern.sen_avbokningens_minuter(p.minuter);
        update public.tillagg_poster t
           set minuter = halv,
               belopp_ore = round(t.pris_ore_per_timme::numeric * halv / 60)::integer,
               status = 'upplupen',
               orsak = 'Sen avbokning: familjen avbokade mindre än gränsen före start, och hälften av tillägget ska betalas.'
         where t.id = p.id;
        return null;
      end if;
      ny := 'frigjord';
      varfor := 'Sen avbokning, utan tillägg (debitera_vid_sen_avbokning är av).';
    elsif new.avbokad_av is not null and new.avbokad_av = new.parent_id then
      if old.status = 'confirmed' then
        ny := 'frigjord';
        varfor := 'Familjen avbokade i tid.';
      else
        ny := 'frigjord';
        varfor := 'Familjen drog tillbaka förfrågan innan den bekräftades.';
      end if;
    elsif new.avbokad_av is not null and new.avbokad_av = new.tutor_id then
      ny := 'frigjord';
      varfor := case when old.status = 'requested' and old.created_by is distinct from new.tutor_id
                     then 'Studiehjälparen avböjde tiden.' else 'Studiehjälparen avbokade passet.' end;
    else
      ny := 'frigjord';
      varfor := 'Passet avbokades av Nextrum.';
    end if;
  elsif new.status = 'cancelled' and old.status = 'completed' and p.status = 'upplupen' then
    ny := 'frigjord';
    varfor := 'Passet avbokades efter att det markerats som genomfört.';
  elsif new.status = 'cancelled' and old.status = 'completed' and p.status in ('i_betalning', 'betald') then
    -- Granskningen 2026-10-21: posten står i en betalning eller är betald.
    -- Släpps betalningen blir posten frigjord (intern.tillagg_poster_tillbaka);
    -- betalas den, eller är den betald, betalas raden tillbaka för hand.
    perform public.skapa_uppgift(
      'Ett pass med syskontillägg avbokades efter att det hållits',
      'tillagg_avbokat:' || p.id,
      'problem',
      'Tillägget för passet ' || new.id || ' ' || case when p.status = 'betald' then 'är betalt'
        else 'betalas just nu' end || '. Betala tillbaka raden under Betalningar → Syskontillägg om familjen inte '
        || 'ska betala det.',
      'profiles', p.familj_id::text);
  end if;

  if ny is not null then
    update public.tillagg_poster t set status = ny, orsak = coalesce(varfor, t.orsak) where t.id = p.id;
  end if;
  return null;
end $function$;

-- intern.bookings_syskon_star_fast()
CREATE OR REPLACE FUNCTION intern.bookings_syskon_star_fast()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  -- sen_avbokning (2026-10-22): att familjen inte flyttar ett bokat pass inom
  -- gränsen gäller nu alla pass, och står i stampla_avbokningen. Här stod
  -- det bara för pass med syskon (granskningen 2026-10-21), med 24 timmar.
  if coalesce(new.extra_barn, '{}') is distinct from coalesce(old.extra_barn, '{}') then
    raise exception using errcode = '42501',
      message = 'Barnen på ett bokat pass ändras inte. Avboka passet och boka ett nytt med rätt barn.';
  end if;
  if cardinality(coalesce(old.extra_barn, '{}')) > 0
     and (new.duration_min is distinct from old.duration_min or new.antal_barn is distinct from old.antal_barn) then
    raise exception using errcode = '42501',
      message = 'Längden på ett pass med syskon ändras inte: tillägget är räknat på den. Avboka passet och boka ett nytt.';
  end if;
  return new;
end $function$;

-- intern.tillagg_poster_vakt()
CREATE OR REPLACE FUNCTION intern.tillagg_poster_vakt()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception using errcode = '42501',
      message = 'En tilläggspost raderas aldrig: den är underlag för en skuld eller en betalning.';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'bokad' or new.betalningsforsok_id is not null or new.betalning_id is not null
       or new.aterbetalt_ore <> 0 or new.upplupen_at is not null or new.betald_at is not null
       or new.frigjord_at is not null or new.avskriven_at is not null or new.aterbetald_at is not null then
      raise exception using errcode = '42501', message = 'En ny tilläggspost börjar som bokad, utan betalning.';
    end if;
    new.skapad_at := now();
    return new;
  end if;

  if (new.id, new.bokning_id, new.familj_id, new.antal_extra_barn, new.pris_ore_per_timme, new.skapad_at)
     is distinct from
     (old.id, old.bokning_id, old.familj_id, old.antal_extra_barn, old.pris_ore_per_timme, old.skapad_at) then
    raise exception using errcode = '42501', message = 'Tilläggets belopp, pass och familj står fast.';
  end if;
  /* sen_avbokning (2026-10-22): tiden och beloppet står fast, utom en gång:
     när passet avbokas sent blir posten upplupen för halva tiden
     (bookings_syskon_foljer), och passet ska då bära den sena avbokningen. */
  if (new.minuter, new.belopp_ore) is distinct from (old.minuter, old.belopp_ore)
     and not (old.status = 'bokad' and new.status = 'upplupen'
              and new.minuter = intern.sen_avbokningens_minuter(old.minuter)
              and exists (select 1 from public.bookings b
                           where b.id = old.bokning_id and b.status = 'cancelled'
                             and b.sen_avbokning_minuter is not null)) then
    raise exception using errcode = '42501', message = 'Tilläggets belopp, pass och familj står fast.';
  end if;
  if new.pass_start is distinct from old.pass_start and old.status <> 'bokad' then
    raise exception using errcode = '42501', message = 'Passets tid följer bara med medan tillägget är bokat.';
  end if;
  if new.aterbetalt_ore < old.aterbetalt_ore then
    raise exception using errcode = '42501', message = 'En återbetalning går inte att ta tillbaka.';
  end if;

  if new.status is distinct from old.status then
    if not ((old.status = 'bokad' and new.status in ('upplupen', 'frigjord'))
            or (old.status = 'upplupen' and new.status in ('i_betalning', 'avskriven', 'frigjord'))
            or (old.status = 'i_betalning' and new.status in ('betald', 'upplupen', 'frigjord'))
            or (old.status = 'betald' and new.status = 'aterbetald')) then
      raise exception using errcode = '23514',
        message = format('Tillägget kan inte gå från %s till %s.', old.status, new.status);
    end if;
    new.upplupen_at := case when new.status = 'upplupen' then coalesce(old.upplupen_at, now()) else old.upplupen_at end;
    new.betald_at := case when new.status = 'betald' then now() else old.betald_at end;
    new.frigjord_at := case when new.status = 'frigjord' then now() else old.frigjord_at end;
    new.avskriven_at := case when new.status = 'avskriven' then now() else old.avskriven_at end;
    new.aterbetald_at := case when new.status = 'aterbetald' then now() else old.aterbetald_at end;
    if new.status in ('upplupen', 'frigjord') then
      new.betalningsforsok_id := null;
    end if;
  elsif (new.upplupen_at, new.betald_at, new.frigjord_at, new.avskriven_at, new.aterbetald_at)
        is distinct from
        (old.upplupen_at, old.betald_at, old.frigjord_at, old.avskriven_at, old.aterbetald_at)
     or new.betalningsforsok_id is distinct from old.betalningsforsok_id
     or new.betalning_id is distinct from old.betalning_id then
    raise exception using errcode = '42501', message = 'Tilläggets tider och betalning följer bara lägena.';
  end if;
  return new;
end $function$;

-- public.mitt_tillagg()
CREATE OR REPLACE FUNCTION public.mitt_tillagg()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  jag uuid := auth.uid();
  i   public.tillagg_installning%rowtype;
begin
  if jag is null then
    raise exception using errcode = '42501', message = 'Logga in först.';
  end if;
  select * into i from public.tillagg_installning where id = 1;
  return jsonb_build_object(
    'pa', coalesce((select f.aktiv from public.flaggor f where f.kod = 'syskonskuld'), false),
    'version', i.villkor_version,
    'godkand_at', (select g.godkand_at from public.tillagg_godkannanden g
                    where g.familj = jag and g.version = i.villkor_version),
    -- sen_avbokning (2026-10-22): gränsen är passets (betalning_installning), och
    -- en sen avbokning gör hälften av tillägget till en skuld.
    'sen_avbokning_timmar', (select b.avbokning_avgift_timmar from public.betalning_installning b where b.id = 1),
    'sen_avbokning_procent', (select b.avbokning_avgift_procent from public.betalning_installning b where b.id = 1),
    'debitera_vid_sen_avbokning', i.debitera_vid_sen_avbokning,
    'obligatorisk', i.obligatorisk_i_nasta_betalning,
    'max_upplupet_ore', i.max_upplupet_ore,
    'sparr_efter_dagar', i.sparr_efter_dagar,
    'paminnelse_dagar', i.paminnelse_dagar,
    'sparr', intern.tillagg_sparr(jag),
    'upplupet_ore', (select coalesce(sum(t.belopp_ore), 0) from public.tillagg_poster t
                      where t.familj_id = jag and t.status = 'upplupen'),
    'upplupna', (select count(*) from public.tillagg_poster t where t.familj_id = jag and t.status = 'upplupen'),
    'i_betalning_ore', (select coalesce(sum(t.belopp_ore), 0) from public.tillagg_poster t
                         where t.familj_id = jag and t.status = 'i_betalning'),
    'i_betalning', (select count(*) from public.tillagg_poster t where t.familj_id = jag and t.status = 'i_betalning'),
    'poster', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', t.id, 'bokning', t.bokning_id, 'start', t.pass_start, 'extra', t.antal_extra_barn,
                  'minuter', t.minuter, 'belopp_ore', t.belopp_ore, 'status', t.status, 'upplupen_at', t.upplupen_at)
                  order by t.pass_start, t.id), '[]'::jsonb)
                 from public.tillagg_poster t
                where t.familj_id = jag and t.status in ('bokad', 'upplupen', 'i_betalning')));
end $function$;

-- public.notis_vid_pass()
CREATE OR REPLACE FUNCTION public.notis_vid_pass()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
-- fakturan_tas_bort (2026-10-21)
declare
  aktor uuid := auth.uid();
  typ   text;
  bas   jsonb;
  elev  text;
  hjalp text;
  m     uuid;
  sen   jsonb;
begin
  if tg_op = 'INSERT' then
    typ := 'pass_nytt';
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    typ := case when old.status = 'requested' and aktor is not null and aktor is distinct from old.created_by
                then 'pass_avbojt' else 'pass_avbokat' end;
  elsif new.status in ('requested', 'confirmed')
        and (new.wanted_date is distinct from old.wanted_date or new.wanted_time is distinct from old.wanted_time) then
    typ := 'pass_flyttat';
  elsif old.status = 'requested' and new.status = 'confirmed' then
    typ := 'pass_bekraftat';
  else
    return null;
  end if;

  select intern.fornamn(s.name) into elev from public.students s where s.id = new.student_id;
  select intern.fornamn(p.full_name) into hjalp from public.profiles p where p.id = new.tutor_id;

  bas := jsonb_strip_nulls(jsonb_build_object(
    'datum', new.wanted_date, 'tid', new.wanted_time, 'langd_min', new.duration_min,
    'amne', intern.fornamn(new.subject), 'studiehjalpare', hjalp, 'status', new.status,
    'fran_datum', case when typ = 'pass_flyttat' then old.wanted_date end,
    'fran_tid', case when typ = 'pass_flyttat' then old.wanted_time end,
    -- En kod ur bookings_avbokningsskal_check, aldrig text. renData()
    -- släpper bara igenom de sex koderna, och mallen skriver orden.
    'skal', case when typ = 'pass_avbokat' then new.avbokningsskal end,
    -- FAS 14.6. Samma sorts kod: mallen ska inte be en familj vars
    -- timmar betalar passet att betala med kort.
    'betalsatt', intern.betalsatt_kod(new.id)));  -- Fas 22.2: också 'timmar'

  /* sen_avbokning (2026-10-22): en sen avbokning säger det i mejlet. Bara
     familjen får avgiften i kronor; studiehjälparen ser att den var sen. */
  sen := case when typ = 'pass_avbokat' and new.sen_avbokning_minuter is not null
              then jsonb_build_object('sen_minuter', new.sen_avbokning_minuter) end;

  foreach m in array array[new.parent_id, new.tutor_id] loop
    continue when m is null or m = aktor;
    perform intern.notis_skapa(m, typ, new.id, new.student_id, new.parent_id, new.tutor_id,
      case when elev is not null and intern.far_se_eleven(m, new.student_id)
           then bas || jsonb_build_object('elev', elev) else bas end
      || coalesce(sen, '{}'::jsonb)
      || case when sen is not null and m = new.parent_id
              then jsonb_build_object('sen_ore', coalesce(new.sen_avbokning_ore, 0)) else '{}'::jsonb end);
  end loop;
  return null;
exception when others then
  insert into public.notis_fel (kalla, fel) values ('notis_vid_pass ' || coalesce(new.id::text, ''), left(sqlerrm, 500));
  return null;
end $function$;

-- ---------- 5. syskontillägget: villkoren och gränsen ----------
-- Villkorstexten för tillägget som skuld står i användarvillkoren från
-- 2026-10-23 (#syskontillagg), och gäller den familj som godkänt tillägget i
-- bokningsrutan. Strömbrytaren står av: sidorna, FAQ:n och /en/ ska säga att
-- tillägget betalas efter passet i samma ändring som den slås på. Gränsen för
-- sen avbokning är passets (avbokning_avgift_timmar); kolumnen här speglar den.
update public.tillagg_installning
   set villkor_version = '2026-10-23', sen_avbokning_timmar = 12
 where id = 1
   and (villkor_version is distinct from '2026-10-23' or sen_avbokning_timmar is distinct from 12);

comment on column public.tillagg_installning.sen_avbokning_timmar is
  'Speglar betalning_installning.avbokning_avgift_timmar sedan sen_avbokning (2026-10-22), och läses inte: passet '
  'avgör om avbokningen var sen (stampla_avbokningen), och då blir hälften av posten en skuld (bookings_syskon_foljer).';
comment on column public.tillagg_installning.debitera_vid_sen_avbokning is
  'syskontillagg_som_skuld (2026-10-21). På: en sen avbokning gör hälften av tillägget till en skuld, som hälften av '
  'passet (sen_avbokning, 2026-10-22). Av: tillägget blir frigjort.';

-- Strömbrytarens text. flaggor_stampla fryser den vid varje skrivning, så den
-- står av bara runt den här raden, som i syskontillagget_fast.
alter table public.flaggor disable trigger flaggor_stampla;

update public.flaggor
   set vantar_pa = 'Att prissidan, FAQ:n och /en/ säger att tillägget betalas som en skuld efter passet, i samma ändring '
                || 'som strömbrytaren slås på. Villkorstexten (#syskontillagg) och versionen i tillagg_installning finns '
                || 'sedan 2026-10-23, och en sen avbokning gör hälften av tillägget till en skuld (sen_avbokning).'
 where kod = 'syskonskuld';

alter table public.flaggor enable trigger flaggor_stampla;

do $$
begin
  if (select tgenabled from pg_trigger
       where tgrelid = 'public.flaggor'::regclass and tgname = 'flaggor_stampla') is distinct from 'O' then
    raise exception 'flaggor_stampla är inte påslagen igen.';
  end if;
end $$;

-- ---------- 5b. vad en avbokning skulle kosta ----------
-- Vyerna frågar databasen innan familjen avbokar, eller vi avbokar på
-- familjens begäran, i stället för att räkna själva: regeln gäller bara ett
-- pass som föreslogs efter att familjen godkänt villkoren med den
-- (intern.familjen_har_avbokningsregeln), och beloppet är det
-- stampla_avbokningen skulle räkna. Bara passets familj och Nextrum får
-- svar; alla andra får null. Ingenting sparas.
create or replace function public.sen_avbokning_lage(p_pass uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  b public.bookings%rowtype;
  m integer;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into b from public.bookings x where x.id = p_pass;
  if not found or not (b.parent_id = auth.uid() or public.is_admin()) then
    return null;
  end if;
  m := intern.sen_avbokningens_minuter(b.duration_min);
  return jsonb_build_object(
    'galler', b.status = 'confirmed' and intern.familjen_har_avbokningsregeln(b.parent_id, b.created_at),
    'sen', intern.avbokningen_ar_sen(intern.passets_start(b.wanted_date, b.wanted_time), now()),
    'minuter', m,
    'ore', intern.sen_avbokningens_pris(b, m),
    'timmar', (select i.avbokning_avgift_timmar from public.betalning_installning i where i.id = 1));
end $function$;

revoke all on function public.sen_avbokning_lage(uuid) from public, anon;
grant execute on function public.sen_avbokning_lage(uuid) to authenticated;
comment on function public.sen_avbokning_lage(uuid) is
  'sen_avbokning (2026-10-22). Om en avbokning av passet nu vore sen, och vad den då kostar: galler (regeln gäller '
  'passet), sen (mindre än gränsen kvar), minuter, ore och timmar. Passets familj och superadmin; andra får null.';

-- ---------- 6. auditen ----------
-- Avgiften sätts av en BEFORE-trigger, så den står aldrig i själva
-- UPDATE:n: en UPDATE OF-trigger hade inte sett den. Villkoret läser den
-- färdiga raden. Ett belopp och en tid, inget namn och ingen fritext.
do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'public.bookings'::regclass and tgname = 'bookings_audit_sen_avbokning') then
    create trigger bookings_audit_sen_avbokning
      after update on public.bookings
      for each row
      when (old.sen_avbokning_minuter is distinct from new.sen_avbokning_minuter
            or old.sen_avbokning_ore is distinct from new.sen_avbokning_ore
            or old.avbokad_for_familjen is distinct from new.avbokad_for_familjen)
      execute function public.logga_andring('pass', 'id', 'sen_avbokning_minuter', 'sen_avbokning_ore',
                                            'avbokad_for_familjen');
  end if;
end $$;

-- ---------- 7. villkorens version ----------
-- sen_avbokning (2026-10-22): avbokningen (#avbokning), betalda pass, timbanken
-- och syskontillägget (#syskontillagg). En hade godkänt 2026-10-22 när filen
-- skrevs, så versionen är nästa dag, och alla får frågan igen.
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-23'::text $$;

-- ---------- 8. prov ----------
do $$
begin
  if intern.sen_avbokningens_minuter(60) <> 30 or intern.sen_avbokningens_minuter(120) <> 60
     or intern.sen_avbokningens_minuter(180) <> 90 then
    raise exception 'sen_avbokning: halva tiden räknas fel.';
  end if;
  if not intern.avbokningen_ar_sen(now() + interval '11 hours 59 minutes', now())
     or intern.avbokningen_ar_sen(now() + interval '12 hours', now())
     or not intern.avbokningen_ar_sen(now() - interval '1 hour', now()) then
    raise exception 'sen_avbokning: gränsen räknas fel.';
  end if;
end $$;
