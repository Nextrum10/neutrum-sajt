-- ============================================================
-- NEXTRUM — svaret på en föreslagen tid, och avbokade pass som
-- räknas utan att tas bort
--
-- Leo 2026-09-30: studiehjälparen ska kunna säga nej till en tid
-- familjen föreslagit och skriva varför, eller föreslå en annan tid
-- med några rader, och familjen ska kunna svara ja eller nej på det
-- motförslaget men inte föreslå en tredje tid ("ingen pingpong").
-- Avbokade pass ska inte ligga kvar och ta plats i listan, men
-- antalet avbokningar ska gå att se över tid.
--
-- DET SOM REDAN FANNS, OCH FÅR STÅ KVAR. Förslaget, motförslaget och
-- nejet är Fas 15.1: ett motförslag ÄR att flytta tiden på ett pass
-- som är 'requested', och då byter created_by sida. Ett nej ÄR
-- 'cancelled'. Krocken prövas av bookings_ingen_overlapp (v9), som
-- gäller både 'requested' och 'confirmed': när studiehjälparen
-- flyttar tiden frigörs den gamla och den nya reserveras i samma
-- skrivning, och två motförslag på samma tid ger 23P01. avbokad_at
-- och avbokad_av stämplas sedan Fas 9.4. Notiserna (pass_avbojt,
-- pass_flyttat, pass_bekraftat) går sedan Runda 2 och bär aldrig
-- brödtext (renData, CLAUDE.md avsnitt 5).
--
-- INGA NYA STATUSAR. En beställning ville ha 'avslagen', 'motforslag'
-- och 'motforslag_avbojt'. Ett trettiotal funktioner räknar på de
-- fyra statusar som finns: klippkort_saldo drar en timme för varje
-- pass som inte är 'cancelled', och ett avslaget förslag med en ny
-- status hade behållit familjens köpta timme. timmar-betalar,
-- upptagna_tider, radera_person, obesvarade_forslag_slapper_timmarna
-- och överlappsvillkoret hade missat en status de inte känner till,
-- och ingenting hade blivit rött.
--
-- INGEN RADERING AV PASS. Ett avbokat pass kan vara betalt och
-- återbetalt (betald_men_avbokad, aterbetald_ore), i tvist, betalt
-- med timbanken (timbank_uttag pekar på det), och ligga i en stängd
-- månad (manadsbokslut låser det). Det är räkenskapsinformation som
-- ska sparas i sju år, och analys_avbokningar räknar avbokningar per
-- månad ur raderna. Listan i vyerna visar därför avbokade pass i 30
-- dagar, antalet räknas ur raderna, och det som är fritext om ett
-- barn (svaret nedan) töms efter 30 dagar av ett nattjobb.
--
-- Fyra saker läggs till:
--
--   1. avbokad_fran: vad passet var när det avbokades. Ett bekräftat
--      pass som avbokas räknas som en avbokning; ett förslag som
--      avslås eller dras tillbaka gör det inte. Stämplas av databasen,
--      och fylls i bakåt ur auditloggen, där statusbytet står sedan
--      Fas 6.1. Äldre rader står som null: okänt, inte noll.
--   2. motforslag_at: när den som fick ett förslag svarade med en
--      annan tid. Stämplas av databasen. På ett motförslag får den som
--      fick det svara ja eller nej, inte flytta tiden igen. Den som
--      gav motförslaget får ändra sin egen tid tills det är besvarat.
--      Ett pass med kortpengar på är undantaget: det går inte att
--      avboka härifrån (Fas 14.1), och utan ett nytt motförslag hade
--      familjen bara kunnat säga ja eller ringa oss.
--   3. svar_meddelande: studiehjälparens rader till familjen, högst
--      500 tecken. KRÄVS när studiehjälparen avslår en tid familjen
--      föreslagit, valfritt med ett motförslag, och skrivs i samma
--      skrivning som svaret, av passets studiehjälpare och ingen
--      annan. Den står INTE i auditloggens vitlista, inte i någon
--      notis och inte i något AI-verktyg: texten handlar om ett barn
--      och stannar i vyn. radera_person tömmer den, och månadslåset
--      släpper igenom tömningen, som för location och note.
--   4. intern.svar_gallra() och pg_cron-jobbet svar-gallring: svaret
--      töms 30 dagar efter avslaget, eller 30 dagar efter passets dag.
--
-- skydda_bokningsfalt, intern.las_stangd_manad och radera_person
-- lappas med replace() och en vakt som räknar att texten hittades
-- exakt en gång (CLAUDE.md avsnitt 5, flera sessioner). Migrationen
-- går att köra två gånger: en lapp som redan finns hoppas över.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolumnerna
-- ------------------------------------------------------------
alter table public.bookings
  add column if not exists avbokad_fran   text,
  add column if not exists motforslag_at  timestamptz,
  add column if not exists svar_meddelande text;

alter table public.bookings drop constraint if exists bookings_avbokad_fran_check;
alter table public.bookings add constraint bookings_avbokad_fran_check
  check (avbokad_fran is null or avbokad_fran in ('requested', 'confirmed', 'completed'));

-- Tom text är inget svar. [^[:space:]] och inte btrim: btrim tar bara
-- mellanslag, och ett "svar" av tre radbrytningar hade gått igenom.
alter table public.bookings drop constraint if exists bookings_svar_meddelande_check;
alter table public.bookings add constraint bookings_svar_meddelande_check
  check (svar_meddelande is null
         or (char_length(svar_meddelande) <= 500 and svar_meddelande ~ '[^[:space:]]'));

comment on column public.bookings.avbokad_fran is
  'Status när passet avbokades: confirmed är en avbokning, requested ett avslaget eller '
  'tillbakadraget förslag. Stämplas av stampla_avbokningen. Null för pass avbokade före '
  'auditloggen (Fas 6.1): okänt.';
comment on column public.bookings.motforslag_at is
  'När den som fick ett förslag svarade med en annan tid. Stämplas av stampla_avbokningen. '
  'Den som fick motförslaget svarar ja eller nej, och flyttar inte tiden igen (skydda_bokningsfalt).';
comment on column public.bookings.svar_meddelande is
  'Studiehjälparens rader till familjen: krävs vid avslag av en föreslagen tid, valfritt med ett '
  'motförslag. Högst 500 tecken. Aldrig i auditloggen, en notis eller ett AI-verktyg. Töms efter '
  '30 dagar (intern.svar_gallra) och när familjen raderas.';

-- ------------------------------------------------------------
-- 2. Stämplarna
--
-- Triggern går nu på insert och varje update, inte bara "update of
-- status": motförslaget känns igen på tiden och created_by. Namnet
-- står kvar, för namnordningen ÄR konstruktionen: den kör efter
-- skydda_bokningsfalt, som jämför det vyn skickade, och före
-- bookings_timmarna_tillbaka, som ska stå sist.
-- ------------------------------------------------------------
create or replace function public.stampla_avbokningen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
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
    return new;
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.avbokad_at := now();
    new.avbokad_av := auth.uid();   -- null när fakturering eller ett schema avbokar
    new.avbokad_fran := case when old.status in ('requested', 'confirmed', 'completed') then old.status end;
    return new;
  end if;

  if new.wanted_date is distinct from old.wanted_date
     or new.wanted_time is distinct from old.wanted_time then
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
end $$;

revoke execute on function public.stampla_avbokningen() from public, anon, authenticated;

drop trigger if exists bookings_stampla_avbokning on public.bookings;
create trigger bookings_stampla_avbokning
  before insert or update on public.bookings
  for each row execute function public.stampla_avbokningen();

-- ------------------------------------------------------------
-- 3. skydda_bokningsfalt: vem som får skriva svaret, att ett avslag
--    kräver det, och att ett motförslag besvaras med ja eller nej
-- ------------------------------------------------------------
do $$
declare
  fore   text := pg_get_functiondef('public.skydda_bokningsfalt'::regproc);
  lista_gammal text := $g$'avbokningsskal'];$g$;
  lista_ny     text := $n$'avbokningsskal', 'svar_meddelande'];$n$;
  ankare text := $g$  if new.status is distinct from old.status then
    if new.status = 'cancelled' then$g$;
  block  text := $n$  /* SVAR PÅ FÖRSLAGET (2026-09-30). Svaret skrivs av passets
     studiehjälpare, i samma skrivning som hen avslår en tid familjen
     föreslagit eller föreslår en annan, eller när hen ändrar sitt eget
     motförslag innan familjen svarat. Aldrig av familjen, aldrig på ett
     bekräftat pass, aldrig i efterhand: familjen har redan läst det. */
  if new.svar_meddelande is distinct from old.svar_meddelande then
    if jag is distinct from old.tutor_id
       or old.status <> 'requested'
       or not ((old.created_by is distinct from jag and (new.status = 'cancelled' or flytt))
               or (old.created_by is not distinct from jag and old.motforslag_at is not null and flytt)) then
      raise exception using errcode = '42501',
        message = 'Ett svar skrivs när studiehjälparen avslår en föreslagen tid eller föreslår en annan.';
    end if;
    if char_length(new.svar_meddelande) > 500 then
      raise exception using errcode = '42501',
        message = 'Svaret får vara högst 500 tecken.';
    end if;
  end if;

  /* Ett nej till familjens tid säger varför. Familjen har bett om en
     tid och ska inte behöva gissa; skälet är fritext, för "den tiden
     har jag fotboll" är inget av fyra fasta skäl. */
  if new.status = 'cancelled' and old.status = 'requested'
     and jag is not distinct from old.tutor_id and old.created_by is distinct from jag
     and coalesce(new.svar_meddelande, '') !~ '[^[:space:]]' then
    raise exception using errcode = '42501',
      message = 'Skriv några rader till familjen om varför tiden inte passar.';
  end if;

  /* Ett motförslag besvaras med ja eller nej. Kortpengar på passet är
     undantaget: då går nej inte härifrån (Fas 14.1), och en ny tid är
     det enda svaret utom ja. */
  if flytt and old.status = 'requested' and old.motforslag_at is not null
     and old.created_by is distinct from jag
     and old.betalning_status not in ('betald', 'tvist') then
    raise exception using errcode = '42501',
      message = 'Ett motförslag besvaras med ja eller nej. Passar tiden inte, avböj den och föreslå en ny.';
  end if;

$n$;
begin
  if position('SVAR PÅ FÖRSLAGET' in fore) > 0 then
    raise notice 'skydda_bokningsfalt har redan svaret, hoppar över.';
    return;
  end if;
  if (length(fore) - length(replace(fore, lista_gammal, ''))) / length(lista_gammal) <> 1 then
    raise exception 'skydda_bokningsfalt: vitlistan hittades inte exakt en gång.';
  end if;
  if (length(fore) - length(replace(fore, ankare, ''))) / length(ankare) <> 1 then
    raise exception 'skydda_bokningsfalt: statusbytet hittades inte exakt en gång.';
  end if;
  execute replace(replace(fore, lista_gammal, lista_ny), ankare, block || ankare);
end $$;

do $$
declare def text := pg_get_functiondef('public.skydda_bokningsfalt'::regproc);
begin
  if position('SVAR PÅ FÖRSLAGET' in def) = 0 or position($s$'svar_meddelande'];$s$ in def) = 0
     or position('FAS 22.1' in def) = 0 or position('FAS 21.1' in def) = 0 then
    raise exception 'skydda_bokningsfalt blev inte ändrad, eller tappade en äldre gren.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. Månadslåset släpper igenom tömningen av svaret
--
-- personer_redigeras_och_raderas släppte igenom location och note
-- till null i en stängd månad. Svaret är samma sorts text, och
-- raderingen tömmer det också. Regeln blir: ingenting annat ändras,
-- och det som ändras blir tomt.
-- ------------------------------------------------------------
do $$
declare
  fore   text := pg_get_functiondef('intern.las_stangd_manad'::regproc);
  gammal text := $g$      if new.location is null and new.note is null
         and (to_jsonb(new) - 'location' - 'note') = (to_jsonb(old) - 'location' - 'note') then$g$;
  ny     text := $n$      -- 2026-09-30: också svaret på ett förslag töms här.
      if (new.location is null or new.location is not distinct from old.location)
         and (new.note is null or new.note is not distinct from old.note)
         and (new.svar_meddelande is null or new.svar_meddelande is not distinct from old.svar_meddelande)
         and (new.location is distinct from old.location or new.note is distinct from old.note
              or new.svar_meddelande is distinct from old.svar_meddelande)
         and (to_jsonb(new) - 'location' - 'note' - 'svar_meddelande')
           = (to_jsonb(old) - 'location' - 'note' - 'svar_meddelande') then$n$;
begin
  if position('också svaret på ett förslag' in fore) > 0 then
    raise notice 'las_stangd_manad har redan svaret, hoppar över.';
    return;
  end if;
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'las_stangd_manad: tömningen hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

-- ------------------------------------------------------------
-- 5. radera_person tömmer svaret
--
-- Familjen: svaret handlar om deras barn, som location och note.
-- Ett barn: likadant, för just det barnets pass, innan barnet rensas.
-- Studiehjälparen: chatten tas bort, och svaret är hens ord i samma
-- samtal.
-- ------------------------------------------------------------
do $$
declare
  fore     text := pg_get_functiondef('public.radera_person(text,uuid)'::regprocedure);
  familj_g text := $g$         set location = null, note = null
       where parent_id = p_id and (location is not null or note is not null);$g$;
  familj_n text := $n$         set location = null, note = null, svar_meddelande = null
       where parent_id = p_id and (location is not null or note is not null or svar_meddelande is not null);$n$;
  elev_g   text := $g$    perform intern.elev_rensa(p_id, satt = 'helt');$g$;
  elev_n   text := $n$    update public.bookings set svar_meddelande = null
     where student_id = p_id and svar_meddelande is not null;
    perform intern.elev_rensa(p_id, satt = 'helt');$n$;
  hjalp_g  text := $g$    delete from public.messages where tutor_id = p_id;$g$;
  hjalp_n  text := $n$    delete from public.messages where tutor_id = p_id;
    update public.bookings set svar_meddelande = null
     where tutor_id = p_id and svar_meddelande is not null;$n$;
begin
  if position('svar_meddelande' in fore) > 0 then
    raise notice 'radera_person tömmer redan svaret, hoppar över.';
    return;
  end if;
  if (length(fore) - length(replace(fore, familj_g, ''))) / length(familj_g) <> 1 then
    raise exception 'radera_person: tömningen av familjens pass hittades inte exakt en gång.';
  end if;
  if (length(fore) - length(replace(fore, elev_g, ''))) / length(elev_g) <> 1 then
    raise exception 'radera_person: rensningen av ett barn hittades inte exakt en gång.';
  end if;
  if (length(fore) - length(replace(fore, hjalp_g, ''))) / length(hjalp_g) <> 1 then
    raise exception 'radera_person: studiehjälparens chatt hittades inte exakt en gång.';
  end if;
  execute replace(replace(replace(fore, familj_g, familj_n), elev_g, elev_n), hjalp_g, hjalp_n);
end $$;

-- ------------------------------------------------------------
-- 6. Gallringen: svaret töms efter 30 dagar
--
-- 30 dagar efter avslaget, eller 30 dagar efter passets dag för ett
-- motförslag som blev ett pass. Raden står kvar: det är passet, och
-- passet är bokföring. Körs som postgres, så skydden och månadslåset
-- släpper igenom den (auth.uid() är null), och auditloggen ser den
-- inte (svar_meddelande står inte i bookings_audit).
-- ------------------------------------------------------------
create or replace function intern.svar_gallra()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  n    integer;
begin
  update public.bookings b
     set svar_meddelande = null
   where b.svar_meddelande is not null
     and case when b.status = 'cancelled'
              then coalesce(b.avbokad_at, b.wanted_date::timestamptz) < now() - interval '30 days'
              else b.wanted_date < idag - 30 end;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function intern.svar_gallra() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'svar-gallring';
select cron.schedule('svar-gallring', '53 3 * * *', $$select intern.svar_gallra()$$);

-- ------------------------------------------------------------
-- 7. avbokad_fran bakåt, ur auditloggen
--
-- bookings_audit har loggat varje statusbyte sedan Fas 6.1, med
-- statusen före i fore. Det är vad som hände, inte en gissning. Pass
-- avbokade före loggen står kvar som null.
-- ------------------------------------------------------------
update public.bookings b
   set avbokad_fran = a.fran
  from (
    select distinct on (l.objekt_id) l.objekt_id, l.fore ->> 'status' as fran
      from public.audit_logg l
     where l.tabell = 'bookings'
       and l.efter ->> 'status' = 'cancelled'
       and l.fore ->> 'status' in ('requested', 'confirmed', 'completed')
     order by l.objekt_id, l.tid desc
  ) a
 where b.id::text = a.objekt_id
   and b.status = 'cancelled'
   and b.avbokad_fran is null;
