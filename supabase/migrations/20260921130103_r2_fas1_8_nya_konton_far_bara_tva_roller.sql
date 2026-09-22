-- ============================================================
-- NEXTRUM — program 2, Fas 1.8: ett nytt konto blir familj eller
-- studiehjälpare, aldrig något annat
--
-- handle_new_user tog rollen rakt ur registreringens metadata. Den
-- metadatan skriver den som registrerar sig själv, och
-- profiles_role_check tillåter 'admin'. En registrering med
-- role='admin' gav alltså en profil med rollen admin.
--
-- I dag ger det ingenting: behörigheten sitter i is_admin, som
-- skyddas av skydda_profilfalt, och ingen policy frågar efter role.
-- Men Fas 1 börjar bjuda in studiehjälpare från adminvyn, och nästa
-- policy som någon skriver med "role = 'tutor'" eller "role =
-- 'admin'" hade gjort metadatan till en rättighet. Självuppgradering
-- till admin är ett av de kända hålen; det här tar bort
-- förutsättningen för att det öppnas igen den vägen.
--
-- 'tutor' blir tutor, allt annat blir parent. Admin sätts fortsatt
-- bara med SQL (is_admin), aldrig genom en registrering.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  roll text := case when new.raw_user_meta_data->>'role' = 'tutor' then 'tutor' else 'parent' end;
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    roll,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );

  if roll = 'tutor' then
    insert into public.tutor_profiles (id) values (new.id);
  end if;

  return new;
end;
$function$;
