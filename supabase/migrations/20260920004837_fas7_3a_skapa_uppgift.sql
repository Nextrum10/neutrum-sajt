-- ============================================================
-- NEXTRUM — Fas 7.3a: en väg in för uppgifter som maskiner skapar
--
-- Automationerna i 7.3 och cron-jobben i 7.2 ska kunna säga "det här
-- behöver en människa titta på" utan att skapa samma uppgift varje
-- gång de kör. Den regeln ska finnas på ETT ställe, inte upprepad i
-- varje kontroll.
--
-- NYCKELN ÄR OBLIGATORISK. Ett automatiskt skapande utan nyckel är
-- en uppgiftslista som växer med en rad per körning tills ingen
-- orkar läsa den. Finns det redan en öppen eller pågående uppgift
-- med samma nyckel händer ingenting, och funktionen svarar null.
--
-- `where not exists`, inte `on conflict`: dubblettindexet
-- uppgifter_oppen_nyckel_idx är PARTIELLT (bara oppen/pagar). En
-- `on conflict (nyckel)` utan samma villkor matchar inget index och
-- blir ett fel i stället för ett hopp. En klar uppgift ska dessutom
-- kunna återkomma — samma faktura kan förfalla igen nästa månad.
--
-- skapad_av_typ sätts EXPLICIT. uppgift_stampel stämplar bara den
-- som är inloggad; ett cron-jobb har ingen auth.uid(), och utan det
-- här hade maskinens uppgifter stått som skapade av en människa.
--
-- Kopplingen nollas i par när tabellen inte är en av de tillåtna.
-- rut_tak står till exempel inte i listan, och en uppgift som faller
-- på ett check-villkor är en kontroll som tyst slutar fungera.
--
-- Funktionen är SECURITY DEFINER och får INTE anropas från
-- webbläsaren: adminvyn skapar uppgifter med ett vanligt insert
-- under sin egen policy, och ska fortsätta göra det.
-- ============================================================

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
                           'invoices','payouts','uppdrag','tjanster','lesson_reports'];
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
  end if;

  begin
    insert into public.uppgifter
      (typ, titel, beskrivning, kopplad_tabell, kopplad_id, nyckel, forfallodag, skapad_av_typ)
    select coalesce(p_typ, 'kontroll'),
           left(btrim(p_titel), 200),
           left(p_beskrivning, 2000),
           tab, idt, p_nyckel, p_forfallodag,
           case when p_skapad_av_typ in ('system', 'ai') then p_skapad_av_typ else 'system' end
     where not exists (
       select 1 from public.uppgifter u
        where u.nyckel = p_nyckel and u.status in ('oppen', 'pagar'))
    returning id into ny;
  exception when unique_violation then
    -- Två körningar samtidigt. Den andra vann, och det är rätt svar.
    return null;
  end;

  return ny;
end $$;

comment on function public.skapa_uppgift(text, text, text, text, text, text, date, text) is
  'Skapar en uppgift om det inte redan finns en öppen med samma nyckel. Svarar med id, eller null när den redan fanns. Bara för serverkod — adminvyn skriver direkt i tabellen.';

revoke execute on function public.skapa_uppgift(text, text, text, text, text, text, date, text)
  from public, anon, authenticated;
