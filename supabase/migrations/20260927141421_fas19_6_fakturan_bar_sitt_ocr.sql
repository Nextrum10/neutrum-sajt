-- ============================================================
-- Fas 19.6: fakturan bär sitt OCR-nummer
--
-- Leo 2026-09-27: familjen ska ha en sida under Betalning med
-- fakturorna som ska betalas, med bankgiro och OCR. Bankgironumret står
-- i nextrum-config.js. OCR-numret är fakturans eget, och det är Fortnox
-- som bestämmer det: det räknas ur fakturanumret med regler som hör till
-- bankgiroavtalet (längdsiffra eller inte). Räknade vi fram det själva
-- och räknade fel, hade familjen betalat med ett OCR banken inte kan
-- matcha, och betalningen hade legat oidentifierad hos Bankgirot.
-- Admin skriver därför in det som står på fakturan i Fortnox, i samma
-- steg som fakturanumret (Lagd i Fortnox).
--
-- Kontrollsiffran prövas här, med 10-modulen (Luhn) som Bankgirot
-- använder. Ett felskrivet OCR fastnar alltså i databasen och inte hos
-- familjens bank. Villkoret körs som anroparen (CLAUDE.md avsnitt 6),
-- så funktionen ligger i intern och får EXECUTE för authenticated:
-- admin sparar med sin egen token.
-- ============================================================

set local lock_timeout = '5s';

create or replace function intern.ocr_giltigt(p text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  n int := length(p);
  s int := 0;
  d int;
  i int;
begin
  if p !~ '^[0-9]{2,25}$' then
    return false;
  end if;
  -- Från höger: kontrollsiffran väger 1, nästa 2, och så vidare.
  for i in 1..n loop
    d := substr(p, n - i + 1, 1)::int;
    if i % 2 = 0 then
      d := d * 2;
      if d > 9 then d := d - 9; end if;
    end if;
    s := s + d;
  end loop;
  return s % 10 = 0;
end $$;

revoke all on function intern.ocr_giltigt(text) from public;
grant execute on function intern.ocr_giltigt(text) to authenticated, service_role;

alter table public.invoices
  add column ocr text constraint invoices_ocr_giltigt check (ocr is null or intern.ocr_giltigt(ocr));

comment on column public.invoices.ocr is
  'Fas 19.6: OCR-numret som står på fakturan i Fortnox. Skrivs av admin vid Lagd i Fortnox; kontrollsiffran prövas.';

do $$
begin
  if not intern.ocr_giltigt('18') or not intern.ocr_giltigt('49927398716')
     or intern.ocr_giltigt('19') or intern.ocr_giltigt('49927398717') or intern.ocr_giltigt('12a4') then
    raise exception 'ocr_giltigt räknar fel.';
  end if;
end $$;
