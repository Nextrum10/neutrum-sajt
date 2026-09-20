-- ============================================================
-- NEXTRUM — Fas 8.4: vad AI:n får läsa
--
-- Fyra läsfunktioner, en per fråga drift-agenten ska kunna ställa.
-- De är inte vyer och inte "select *": varje kolumn står skriven, och
-- det är själva poängen.
--
-- PERSONUPPGIFTER SKICKAS INTE I ONÖDAN.
-- Planen säger "skicka minsta möjliga", och för Nextrum betyder det
-- uppgifter om barn. Därför:
--   · inga namn på elever — initialer räcker för att en människa ska
--     känna igen raden när den visas i adminvyn bredvid id:t
--   · inga föräldranamn, inga e-postadresser, inga telefonnummer
--   · ingen bookings.location — fältet heter "Var ses ni?" och
--     innehåller i praktiken en hemadress
--   · inget rapportinnehåll: en lektionsrapport handlar om ett barns
--     svårigheter, och agenten behöver bara veta ATT den saknas
--
-- FRITEXTEN SOM ÄR KVAR ÄR KAPAD OCH TVÄTTAD.
-- leads.message är det enda fält där en utomstående skriver fritt och
-- agenten ändå behöver läsa, för det är där familjen berättar vad de
-- behöver. Den kapas till 500 tecken, och långa sifferföljder
-- maskeras: anmälningsformuläret klistrar in "Telefon: …" i samma
-- fält, och ett telefonnummer är en personuppgift som inte gör
-- agenten klokare. Texten märks dessutom som data innan modellen ser
-- den (_delad/agent.ts, somDatabasData) — det här är andra lagret,
-- inte det enda.
--
-- Alla fyra är STABLE. En STABLE-funktion kan inte skriva, och det
-- är läsgarantin uttryckt i databasen i stället för i en kommentar.
-- ============================================================

create or replace function public.ai_nya_leads(p_dagar integer default 21)
returns table (
  id        uuid,
  skapad    date,
  status    text,
  tjanst    text,
  arskurs   text,
  amne      text,
  meddelande text,
  dagar_gammal integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.id,
         (l.created_at at time zone 'Europe/Stockholm')::date,
         l.status,
         l.tjanst,
         l.grade,
         l.subject,
         -- Sifferföljder på sex eller fler tecken maskeras: det är
         -- telefonnummer, personnummer och kontonummer i praktiken.
         left(regexp_replace(coalesce(l.message, ''), '[0-9][0-9 +()-]{5,}', '[nummer]', 'g'), 500),
         (current_date - (l.created_at at time zone 'Europe/Stockholm')::date)::integer
    from public.leads l
   where l.created_at > now() - make_interval(days => greatest(p_dagar, 1))
   order by l.created_at desc
   limit 100;
$$;

create or replace function public.ai_omatchade_elever()
returns table (
  id            uuid,
  initialer     text,
  arskurs       text,
  amnen         text[],
  skapad        date,
  dagar_utan_match integer,
  match_status  text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.id,
         -- Initialer, inte namn. Tillräckligt för att känna igen
         -- raden bredvid id:t i adminvyn, för lite för att vara en
         -- uppgift om barnet.
         (select string_agg(left(del, 1), '.') from unnest(string_to_array(coalesce(s.name, ''), ' ')) del
           where del <> ''),
         s.grade,
         s.subjects,
         (s.created_at at time zone 'Europe/Stockholm')::date,
         (current_date - (s.created_at at time zone 'Europe/Stockholm')::date)::integer,
         s.match_status
    from public.students s
   where s.matched_tutor_id is null or s.match_status <> 'matched'
   order by s.created_at
   limit 100;
$$;

create or replace function public.ai_kommande_pass(p_dagar integer default 7)
returns table (
  id        uuid,
  datum     date,
  tid       text,
  minuter   integer,
  amne      text,
  format    text,
  status    text,
  elev_id   uuid,
  studiehjalpare_id uuid
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.wanted_date, b.wanted_time, b.duration_min, b.subject, b.format,
         b.status, b.student_id, b.tutor_id
    from public.bookings b
   where b.wanted_date between (now() at time zone 'Europe/Stockholm')::date
                           and (now() at time zone 'Europe/Stockholm')::date
                               + make_interval(days => greatest(p_dagar, 1))
     and b.status in ('requested', 'confirmed')
   order by b.wanted_date, b.wanted_time
   limit 200;
$$;

create or replace function public.ai_saknade_rapporter(p_dagar integer default 45)
returns table (
  id       uuid,
  datum    date,
  amne     text,
  status   text,
  elev_id  uuid,
  studiehjalpare_id uuid,
  har_uppgift boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.wanted_date, b.subject, b.status, b.student_id, b.tutor_id,
         exists (select 1 from public.uppgifter u
                  where u.nyckel = 'kontroll:saknad_rapport:bookings:' || b.id::text
                    and u.status in ('oppen', 'pagar'))
    from public.bookings b
   where b.status in ('confirmed', 'completed')
     and b.fakturerbar
     and b.wanted_date > (now() at time zone 'Europe/Stockholm')::date
                         - make_interval(days => greatest(p_dagar, 1))
     and b.wanted_date < (now() at time zone 'Europe/Stockholm')::date
     and not exists (select 1 from public.lesson_reports lr where lr.booking_id = b.id)
   order by b.wanted_date
   limit 200;
$$;

revoke execute on function public.ai_nya_leads(integer) from public, anon, authenticated;
revoke execute on function public.ai_omatchade_elever() from public, anon, authenticated;
revoke execute on function public.ai_kommande_pass(integer) from public, anon, authenticated;
revoke execute on function public.ai_saknade_rapporter(integer) from public, anon, authenticated;

-- skapa_uppgift har sin egen kopia av listan över tillåtna tabeller.
-- 8.2 la till ai_forslag i check-villkoret; utan den här ändringen
-- nollar funktionen kopplingen tyst för just den tabellen.
create or replace function public.skapa_uppgift(
  p_titel          text,
  p_nyckel         text,
  p_typ            text default 'kontroll',
  p_beskrivning    text default null,
  p_kopplad_tabell text default null,
  p_kopplad_id     text default null,
  p_forfallodag    date default null,
  p_skapad_av_typ  text default 'system'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  tillatna text[] := array['leads','applications','profiles','students','bookings',
                           'invoices','payouts','uppdrag','tjanster','lesson_reports','ai_forslag'];
  tab text := p_kopplad_tabell;
  idt text := p_kopplad_id;
  ny  uuid;
begin
  if p_nyckel is null or char_length(p_nyckel) < 3 then
    raise exception using errcode = '22023',
      message = 'skapa_uppgift kräver en nyckel: det är den som hindrar dubbletter.';
  end if;

  if tab is null or idt is null or not (tab = any (tillatna)) then
    tab := null;
    idt := null;
  elsif tab <> 'tjanster'
        and idt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    tab := null;
    idt := null;
  end if;

  begin
    perform set_config('nextrum.maskin', '1', true);

    insert into public.uppgifter
      (typ, titel, beskrivning, kopplad_tabell, kopplad_id, nyckel, forfallodag, skapad_av_typ)
    select coalesce(p_typ, 'kontroll'),
           left(btrim(p_titel), 200),
           left(p_beskrivning, 2000),
           tab, idt, p_nyckel, p_forfallodag,
           case when p_skapad_av_typ in ('system', 'ai') then p_skapad_av_typ else 'system' end
     where not exists (
       select 1 from public.uppgifter u
        where u.nyckel = p_nyckel and u.status in ('oppen', 'pagar', 'avbruten'))
    returning id into ny;

    perform set_config('nextrum.maskin', '', true);
  exception when unique_violation then
    perform set_config('nextrum.maskin', '', true);
    return null;
  end;

  return ny;
end $$;

revoke execute on function public.skapa_uppgift(text, text, text, text, text, text, date, text)
  from public, anon, authenticated;
