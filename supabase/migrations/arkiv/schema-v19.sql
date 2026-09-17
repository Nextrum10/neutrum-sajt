-- ============================================================
-- NEXTRUM — schema v19
-- TJÄNSTERNA PÅ ENGELSKA
--
-- Körs efter schema-v18.sql. Idempotent.
--
--
-- VARFÖR NU OCH INTE SEDAN
--
-- Katalogen i v18 har ett namn per tjänst, på svenska. De sju
-- publika sidorna finns på två språk, och tjänsteväljaren ritas i
-- intresseanmälan och i ansökan — alltså på /en/ också.
--
-- Med bara läxhjälp aktiv är felet litet och tyst: den engelska
-- sidan säger "Applies to läxhjälp." Den dagen någon slår på
-- barnvakt blir det tre svenska kort mitt i ett engelskt formulär,
-- och ingen kommer att koppla det till en migration som kördes
-- långt tidigare.
--
-- Två kolumner nu är billigare än att upptäcka det då. Se
-- project-nextrum-engelska i minnet: engelskan slutar följa med,
-- och det syns inte.
--
--
-- VARFÖR KOLUMNER OCH INTE EN ÖVERSÄTTNINGSTABELL
--
-- Två språk och fyra rader. En tabell med språkkod hade varit rätt
-- vid fem språk och fel vid två — den hade lagt till en join i
-- varje läsning för att slippa en kolumn vi ändå behöver.
-- ============================================================

alter table public.tjanster
  add column if not exists namn_en text,
  add column if not exists kort_en text;

comment on column public.tjanster.namn_en is
  'Tjänstens namn på engelska. NULL = fall tillbaka på namn. Läses av NXTjanster när <html lang> börjar på "en".';
comment on column public.tjanster.kort_en is
  'Den korta beskrivningen på engelska. NULL = fall tillbaka på kort.';

-- Bara där det saknas. Har någon skrivit en bättre formulering i
-- adminvyn ska den inte skrivas över av en migration som körs om.
update public.tjanster set
  namn_en = coalesce(namn_en, 'Tutoring'),
  kort_en = coalesce(kort_en, 'A tutor who recently took the same courses. At your home or online.')
where kod = 'laxhjalp';

update public.tjanster set
  namn_en = coalesce(namn_en, 'Babysitting'),
  kort_en = coalesce(kort_en, 'Childcare, at your home.')
where kod = 'barnvakt';

update public.tjanster set
  namn_en = coalesce(namn_en, 'Home help'),
  kort_en = coalesce(kort_en, 'A hand around the house.')
where kod = 'hushallsnara';

update public.tjanster set
  namn_en = coalesce(namn_en, 'Sales'),
  kort_en = coalesce(kort_en, 'Assignments for us and for other companies. A job, not something a family orders.')
where kod = 'forsaljning';


-- ============================================================
-- EFTERÅT
--
--   select kod, namn, namn_en from public.tjanster order by ordning;
--   -- ingen rad ska ha namn_en null
--
--
-- NÄR NI LÄGGER TILL EN TJÄNST
--
-- Fyll i namn_en och kort_en samtidigt. En tjänst utan engelskt
-- namn faller tillbaka på det svenska, vilket betyder att felet
-- syns som ett svenskt ord på en engelsk sida — inte som ett
-- tomt kort. Det är med flit: ett tomt kort hade sett ut som en
-- bugg i koden, ett svenskt ord pekar på vad som faktiskt saknas.
-- ============================================================
