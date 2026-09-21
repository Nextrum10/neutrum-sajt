-- ============================================================
-- NEXTRUM — program 2, Fas 1.5: bara en godkänd studiehjälpare
-- kan matchas
--
-- students.matched_tutor_id pekade på profiles med en FK och inget
-- mer. Ingenting frågade om profilen var en studiehjälpare, än
-- mindre en godkänd. Det spelade liten roll så länge den enda vägen
-- in i poolen var en ansökan. Fas 1 lägger till en väg till: admin
-- bjuder in en befintlig anställd direkt. Då räcker en felskriven
-- adress för att en främling får ett konto med rollen studiehjälpare
-- — ofarligt tills någon matchar hen, för det är matchningen som
-- öppnar elevens rapporter, läxor, material och familjens adress.
--
-- Så matchningen får en egen grind: den som matchas måste ha en
-- tutor_profiles-rad med status approved. Grinden gäller ALLA,
-- också admin — det är ju admin som matchar, och det är admins
-- misstag den ska fånga. Ett föräldrakonto har ingen tutor_profiles-
-- rad och kan därför aldrig bli någons studiehjälpare.
--
-- Bara när matchningen SÄTTS eller BYTS. En studiehjälpare som
-- senare stängs av behåller sina elever tills admin flyttar dem;
-- att tyst lossa en pågående matchning är ett annat beslut.
--
-- Triggern heter students_matchning_… och körs därför före
-- students_skydda (bokstavsordning), så en familj som försöker
-- matcha sitt barn med en icke godkänd profil får ett fel i stället
-- för att skyddet tyst återställer fältet. Båda nekar.
-- ============================================================

create or replace function public.matchning_kraver_godkand()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.matched_tutor_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.matched_tutor_id is not distinct from old.matched_tutor_id then
    return new;
  end if;
  if not exists (select 1 from public.tutor_profiles t
                  where t.id = new.matched_tutor_id and t.status = 'approved') then
    raise exception using errcode = '23514',
      message = 'Eleven kan bara matchas med en godkänd studiehjälpare.';
  end if;
  return new;
end $$;

revoke execute on function public.matchning_kraver_godkand() from public, anon, authenticated;

drop trigger if exists students_matchning_kraver_godkand on public.students;
create trigger students_matchning_kraver_godkand
  before insert or update of matched_tutor_id on public.students
  for each row execute function public.matchning_kraver_godkand();
