-- ============================================================
-- Klientfelen minns vem det gällde
--
-- klientfel.anvandare har funnits sedan schema v10, och adminvyn
-- bygger Vem och knappen Skriv till de drabbade på den. Ingen satte
-- den: nextrum-fel.js skickar den inte, och kolumnen hade inget
-- förval. Varje fel stod därför som Utloggad under System → Fel, också
-- de fyra en inloggad admin fick när auditloggen kraschade 2026-09-27,
-- och knappen visades aldrig. Registret i DATASKYDD.md (rad 12) och
-- integritetspolicyn räknar redan med konto-id i felrapporterna, med
-- berättigat intresse och 90 dagar (kontakt-och-fel-gallring).
--
-- Triggern sätter kolumnen själv ur auth.uid() och skriver över det
-- klienten skickar. Insert-policyn släpper in vem som helst (with
-- check true), så en kolumn klienten fick fylla hade låtit vem som
-- helst lägga ett fel i någon annans namn, och knappen hade då mejlat
-- fel person. Saknar kontot en profil blir den null: kolumnen pekar på
-- profiles, och ett fel som inte går att spara är värre än ett fel
-- utan namn.
-- ============================================================

create or replace function intern.klientfel_vem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.anvandare := (select p.id from public.profiles p where p.id = auth.uid());
  return new;
end $$;

-- En trigger prövar rättigheten när den skapas, inte när den körs
-- (CLAUDE.md, avsnitt 6). rls-test.sql 19.4 fångar en som glömts.
revoke execute on function intern.klientfel_vem() from public, anon, authenticated;

drop trigger if exists klientfel_vem on public.klientfel;
create trigger klientfel_vem
  before insert on public.klientfel
  for each row execute function intern.klientfel_vem();
