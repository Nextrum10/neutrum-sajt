-- ============================================================
-- Matchningen läser ämnen som koder (2026-10-21)
--
-- amnen_mots() jämförde fritext med position(): "Matte" mötte inte
-- "Matematik", "NO" mötte inte "Fysik", och "Flera ämnen" mötte
-- ingenting, så en elev med flera ämnen fick ett hårt nej (under 50)
-- mot varje studiehjälpare. Korta ord kunde dessutom träffa inuti
-- andra ("no" i "teknologi").
--
-- Nu blir varje ämne först en eller flera fasta koder (amne_koder),
-- som jämförs exakt. "Flera ämnen" (eller alla/blandat/olika/osäker/
-- vet ej) läses som kärnämnena matematik, svenska och engelska.
-- Signaturen och svaret ({traffar, av} eller null) är desamma, så
-- matchningspoang() och allt ovanför den rörs inte.
-- ============================================================

create or replace function public.amne_koder(p text[])
returns text[]
language plpgsql
immutable
set search_path to 'public'
as $f$
declare
  v  text;
  s  text;
  ut text[] := '{}';
  n  int;
begin
  foreach v in array coalesce(p, '{}'::text[]) loop
    -- Mellanslag runt om, så att varje ord kan prövas som helt ord.
    s := ' ' || btrim(regexp_replace(lower(v), '[^a-zåäöé0-9]+', ' ', 'g')) || ' ';
    if btrim(s) = '' then continue; end if;
    n := coalesce(array_length(ut, 1), 0);

    if s ~ ' (flera|alla|blandat|osäker|olika) ' or s ~ ' vet ej ' then ut := ut || array['flera']; end if;
    if s ~ ' (matte|matematik|ma) '                    then ut := ut || array['matematik']; end if;
    if s ~ ' no '                                       then ut := ut || array['fysik','kemi','biologi']; end if;
    if s ~ ' fysik '                                    then ut := ut || array['fysik']; end if;
    if s ~ ' kemi '                                     then ut := ut || array['kemi']; end if;
    if s ~ ' (biologi|bio) '                            then ut := ut || array['biologi']; end if;
    if s ~ ' so '                                       then ut := ut || array['historia','samhallskunskap','geografi','religion']; end if;
    if s ~ ' historia '                                 then ut := ut || array['historia']; end if;
    if s ~ ' (samhällskunskap|samhälle|samhällsvetenskap) ' then ut := ut || array['samhallskunskap']; end if;
    if s ~ ' geografi '                                 then ut := ut || array['geografi']; end if;
    if s ~ ' (religion|religionskunskap) '              then ut := ut || array['religion']; end if;
    if s ~ ' svenska '                                  then ut := ut || array['svenska']; end if;
    if s ~ ' (engelska|eng) '                           then ut := ut || array['engelska']; end if;
    if s ~ ' (moderna språk|spanska|tyska|franska) '    then ut := ut || array['moderna_sprak']; end if;

    -- Okänt ämne: jämförs som det står, men bara exakt.
    if coalesce(array_length(ut, 1), 0) = n then ut := ut || array[btrim(s)]; end if;
  end loop;

  return (select array_agg(distinct x order by x) from unnest(ut) x);
end $f$;

comment on function public.amne_koder(text[]) is
  'Fritextämnen till fasta koder (matematik, fysik, svenska ...). NO och SO blir sina delämnen, "Flera ämnen" blir flera. Okända ämnen står kvar som de är skrivna. Används av amnen_mots().';

create or replace function public.amnen_mots(p_elev text[], p_tutor text[])
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $f$
declare
  e       text[] := public.amne_koder(p_elev);
  t       text[] := public.amne_koder(p_tutor);
  traffar int;
begin
  if coalesce(array_length(e, 1), 0) = 0 or coalesce(array_length(t, 1), 0) = 0 then
    return null;
  end if;

  -- "Flera ämnen": kärnämnena. Bättre än ett hårt nej mot alla.
  if 'flera' = any(e) then
    e := array(select distinct x
                 from unnest(array_remove(e, 'flera') || array['matematik','svenska','engelska']) x);
  end if;

  select count(*) into traffar from unnest(e) x where x = any(t);
  return jsonb_build_object('traffar', traffar, 'av', array_length(e, 1));
end $f$;

revoke execute on function public.amne_koder(text[]) from public, anon;
