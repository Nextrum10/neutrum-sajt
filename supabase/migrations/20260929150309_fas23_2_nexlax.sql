-- ============================================================
-- NEXTRUM — Fas 23.2: NexLäx
--
-- Leo 2026-09-29: Uppgifter och Min utveckling blir EN sektion i
-- studievyn, NexLäx, "Nextrums egna Duolingo-liknande lärsystem för
-- skolämnen". Eleven ska se var hen är, vad hen klarat, vad som är
-- nästa steg och vad som låses upp, med XP och en serie i dagar, och
-- NexLäx ska hänga ihop med studiehjälparen och passen. Tabellerna är
-- desamma som i Fas 23.1; det här lägger till fyra saker.
--
-- 1. NIVÅNS SORT (nivaer.sort)
--      vanlig      en nivå med egna frågor, som förut
--      mastare     Mästarprovet sist i ett område. Frågorna dras ur
--                  områdets vanliga nivåer, högst tio och i ny ordning
--                  varje gång. Provet har inga egna frågor och alltså
--                  inget eget facit som kan glida isär från nivåerna.
--      repetition  en per bana: frågor eleven senast svarade fel på
--                  första gången, senaste missen först, påfyllt med
--                  frågor ur nivåer eleven redan klarat.
--    Båda dras i niva_starta(). Försöket bär sina frågor (fragor[]),
--    så rättningen, betyget och genomgången är desamma som för en
--    vanlig nivå. Frågor ur en nivå med lästext dras inte: de handlar
--    om en text som provet inte visar.
--
-- 2. LÄSTEXTEN (nivaer.lastext). Läsförståelse: texten står på nivån,
--    lämnas ut av niva_starta() och frågorna handlar om den.
--
-- 3. MATCHNING (niva_fragor.typ = 'para'). 2–6 par i ratt, som
--    [vänster, höger]. Vänstersidan lämnas ut i sin ordning och
--    högersidan blandad; svaret är högersidan i vänsterns ordning,
--    {"par": [...]}, och rättas här som de andra typerna. Sant eller
--    falskt är ingen egen typ: det är ett val med alternativen Sant och
--    Falskt (grund.sant() i verktyget), och rättas som ett val.
--
-- 4. XP, SOM RÄKNAS OCH INTE SPARAS. Leo: "XP ska sparas mot den
--    riktiga användaren." Det gör det: varje poäng räknas ur svaren och
--    försöken, som bara databasen skriver (Fas 23.1), av
--    nexlax_lage() och niva_svara(). En egen tabell med poäng hade
--    kunnat säga något annat än svaren den bygger på, samma skäl som
--    för stjärnorna. Reglerna står här och bara här (intern.nexlax_*),
--    och vyerna får dem i nexlax_lage().regler:
--       10 XP  en fråga man väljer svaret på: val, sant eller falskt
--       20 XP  en fråga man skriver, bygger eller parar ihop själv:
--              skriv, ordna, para. Svårare, för svaret står inte framme.
--       50 XP  en nivå klarad första gången (minst en stjärna)
--      100 XP  ett område klarat: varje vanlig nivå i det klarad
--    En fråga ger XP EN gång: första gången den besvaras rätt direkt,
--    i vilket försök som helst, också i ett mästarprov eller en
--    repetition. Att göra om en nivå man redan kan ger inga nya poäng
--    för det man redan fått, men en fråga man missade förra gången ger
--    sina poäng när den sitter. XP mäter alltså vad eleven klarat, inte
--    hur många gånger hen tryckt. En ändrad fråga har ett nytt id och
--    är en ny fråga. XP minskar aldrig: ett område som får en ny nivå
--    behåller sina 100, för klarat räknas mot de nivåer som fanns då
--    (nivaer.created_at).
--
-- SERIEN RÄKNAS I DAGAR, i svensk tid (nexlax_lage). Fas 23.1 valde
-- veckor, för att en serie som bryts varje torsdag är en skuld och
-- inte en belöning, och banan hade bara ett fåtal nivåer. Leo
-- 2026-09-29 vill ha dagar ("🔥 7 dagar"), och NexLäx är till för
-- träningen MELLAN passen. Därför räknas tre sorters dagar: en dag då
-- eleven gjort klart en nivå (också en utan stjärnor: hen har till
-- slut svarat rätt på allt), gjort klart något från studiehjälparen,
-- eller haft ett pass med rapport. Passdagen räknas med flit: ett barn
-- med pass på tisdagen ska inte förlora serien för att det inte också
-- gjorde en nivå. Serien bryts först när en hel dag gått utan något,
-- så den ser aldrig bruten ut på morgonen, ingenting påminner om den
-- (ingen notistyp), och rekordet står kvar.
--
-- ENHETER MED SNEDSTRECK OCH EXPONENT. "15 km/h", "9,8 N/kg" och "3 m/s"
-- rättas som talet, som "12 cm" redan gjorde (intern.niva_tal), och så
-- gör "20 cm2" och "60 dm^3": ett tangentbord utan ² skriver en tvåa.
-- Fysiken i åk 8 frågar efter fart och tyngd och geometrin efter area
-- och volym, och ett rätt svar med sin enhet hade annars rättats som
-- fel. grund.talvarde() i verktyget följer med.
--
-- VAKTEN. niva_starta, niva_svara, intern.niva_ratta,
-- intern.niva_fraga_ut och intern.niva_tal skrivs om i sin helhet. Står något annat i
-- driften än Fas 23.1:s version (md5 på pg_get_functiondef, läst i
-- driften 2026-09-29) avbryts migrationen i stället för att tyst
-- skriva över en ändring från en annan session (CLAUDE.md avsnitt 5).
-- ============================================================

do $$
declare
  f record;
begin
  for f in select * from (values
      ('public.niva_starta(uuid,uuid)',             '473238b3ba2b9ea1ea9113c10fa4fca6'),
      ('public.niva_svara(uuid,uuid,jsonb)',        'ba865474134934cd97e13a0f782b3d1f'),
      ('intern.niva_ratta(public.niva_fragor,jsonb)', 'f58ba7a4bc627dbf289feca5a9573af8'),
      ('intern.niva_fraga_ut(public.niva_fragor)',  '2e2f5e23179551ca31172497909a4190'),
      ('intern.niva_tal(text,boolean)',             'cd143654f1f9d165d3b05b3afb5b15c0')) v(namn, md5)
  loop
    if md5(coalesce(pg_get_functiondef(to_regprocedure(f.namn)), '')) is distinct from f.md5 then
      raise exception '% är inte Fas 23.1:s version i den här databasen. Läs driften och lappa i stället för att skriva över.', f.namn;
    end if;
  end loop;
end $$;

-- ---------- nivåns sort och lästext ----------
alter table public.nivaer
  add column if not exists sort text not null default 'vanlig',
  add column if not exists lastext text;

alter table public.nivaer drop constraint if exists nivaer_sort_check;
alter table public.nivaer add constraint nivaer_sort_check
  check (sort in ('vanlig', 'mastare', 'repetition'));

alter table public.nivaer drop constraint if exists nivaer_lastext_check;
alter table public.nivaer add constraint nivaer_lastext_check
  check (lastext is null or (sort = 'vanlig' and length(btrim(lastext)) between 1 and 3000));

comment on column public.nivaer.sort is
  'vanlig: egna frågor. mastare: Mästarprovet sist i området, frågorna dras ur områdets vanliga nivåer. '
  'repetition: en per bana, det eleven missat. Dras i niva_starta() (Fas 23.2).';
comment on column public.nivaer.lastext is
  'Läsförståelse: texten frågorna handlar om. Lämnas ut av niva_starta() (Fas 23.2).';

-- ---------- matchning ----------
alter table public.niva_fragor drop constraint if exists niva_fragor_typ_check;
alter table public.niva_fragor add constraint niva_fragor_typ_check
  check (typ in ('val', 'skriv', 'ordna', 'para'));

-- Paren prövas med jsonpath och inte med en hjälpfunktion: ett
-- CHECK-villkor körs som den som skriver (CLAUDE.md avsnitt 6), och en
-- funktion i intern hade nekat admin. Att vänster- och högersidorna är
-- olika inbördes prövar verktyget; rättningen går på plats, så ett
-- dubblerat ord hade bara gjort frågan tvetydig, inte trasig.
alter table public.niva_fragor drop constraint if exists niva_fragor_formen;
alter table public.niva_fragor add constraint niva_fragor_formen check (
  case typ
    when 'val' then
      coalesce(jsonb_typeof(alternativ) = 'array', false)
      and jsonb_array_length(alternativ) between 2 and 5
      and jsonb_typeof(ratt) = 'number'
      and (ratt #>> '{}') ~ '^[0-9]$'
      and (ratt #>> '{}')::int < jsonb_array_length(alternativ)
    when 'skriv' then
      jsonb_typeof(ratt) = 'array' and jsonb_array_length(ratt) between 1 and 12
    when 'para' then
      jsonb_typeof(ratt) = 'array' and jsonb_array_length(ratt) between 2 and 6
      and alternativ is null
      and not jsonb_path_exists(ratt, 'strict $[*] ? (@.type() != "array" || @.size() != 2)', '{}', true)
      and not jsonb_path_exists(ratt, 'strict $[*][*] ? (@.type() != "string" || @ == "")', '{}', true)
    else
      jsonb_typeof(ratt) = 'array' and jsonb_array_length(ratt) between 2 and 14
      and (alternativ is null or jsonb_typeof(alternativ) = 'array')
  end);

-- ---------- talet i ett svar, också med km/h och cm2 ----------
-- Samma som Fas 23.1, med ett snedstreck och ett ord till i enheten, och
-- en längdenhet med 2 eller 3 efter sig (m2, cm^2, dm3). Bara en
-- längdenhet: "3x2" ska inte bli talet 3. Facit läses fortfarande utan
-- enhet: bara ett rent tal jämförs som tal.
create or replace function intern.niva_tal(t text, p_enhet boolean default true)
returns numeric
language plpgsql
immutable
as $$
declare
  m text[];
begin
  t := regexp_replace(regexp_replace(t, '(\d) (\d)', '\1\2', 'g'), '(\d) (\d)', '\1\2', 'g');
  if p_enhet then
    m := regexp_match(t, '^([-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(?:%|(?:[kcdm]?m\^?[23]|[a-zåäö²³°ω]{1,12}(?:/[a-zåäö²³°ω]{1,12})?\.?)(?: [a-zåäö²³°ω]{1,12}(?:/[a-zåäö²³°ω]{1,12})?\.?)?)?$');
  else
    m := regexp_match(t, '^([-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*%?$');
  end if;
  if m is null then
    return null;
  end if;
  return replace(m[1], ',', '.')::numeric;
exception when others then
  return null;
end $$;

-- ---------- rättningen, med matchningen ----------
create or replace function intern.niva_ratta(q public.niva_fragor, p_svar jsonb)
returns boolean
language plpgsql
stable
as $$
declare
  v    text;
  gavs text[];
  ska  text[];
begin
  if q.typ = 'val' then
    v := p_svar ->> 'val';
    return coalesce(v ~ '^[0-9]$' and v::int = (q.ratt #>> '{}')::int, false);
  elsif q.typ = 'skriv' then
    v := p_svar ->> 'text';
    if v is null or length(v) > 200 then
      return false;
    end if;
    return exists (select 1 from jsonb_array_elements_text(q.ratt) a where intern.niva_lika(a, v));
  elsif q.typ = 'ordna' then
    if coalesce(jsonb_typeof(p_svar -> 'ordning'), '') <> 'array' then
      return false;
    end if;
    select array_agg(btrim(x) order by n) into gavs
      from jsonb_array_elements_text(p_svar -> 'ordning') with ordinality y(x, n);
    select array_agg(btrim(x) order by n) into ska
      from jsonb_array_elements_text(q.ratt) with ordinality y(x, n);
    return coalesce(gavs = ska, false);
  elsif q.typ = 'para' then
    -- Högersidan i vänsterns ordning. Alla par måste stämma: ett
    -- halvrätt svar är fel, som en halv mening i en ordna-fråga.
    if coalesce(jsonb_typeof(p_svar -> 'par'), '') <> 'array'
       or jsonb_array_length(p_svar -> 'par') <> jsonb_array_length(q.ratt) then
      return false;
    end if;
    select array_agg(btrim(x) order by n) into gavs
      from jsonb_array_elements_text(p_svar -> 'par') with ordinality y(x, n);
    select array_agg(btrim(p ->> 1) order by n) into ska
      from jsonb_array_elements(q.ratt) with ordinality y(p, n);
    return coalesce(gavs = ska, false);
  end if;
  return false;
end $$;

-- Frågan som den lämnas ut, utan facit. Högersidan i en matchning
-- blandas här, som brickorna i en ordna-fråga: i tabellen står den
-- bredvid sitt par.
create or replace function intern.niva_fraga_ut(q public.niva_fragor)
returns jsonb
language plpgsql
volatile
as $$
declare
  brickor jsonb;
  ratt    jsonb;
  varv    int := 0;
begin
  if q.typ = 'val' then
    return jsonb_build_object('id', q.id, 'typ', q.typ, 'fraga', q.fraga, 'alternativ', q.alternativ);
  elsif q.typ = 'skriv' then
    -- Sifferknappsatsen bara när varje godtaget svar är ett tal utan
    -- minustecken: iPhones decimaltangentbord saknar minus.
    return jsonb_build_object('id', q.id, 'typ', q.typ, 'fraga', q.fraga,
      'numerisk', not exists (
        select 1 from jsonb_array_elements_text(q.ratt) a
         where intern.niva_tal(intern.niva_norm(a), false) is null or intern.niva_norm(a) like '-%'));
  elsif q.typ = 'para' then
    select jsonb_agg(p -> 1 order by n) into ratt
      from jsonb_array_elements(q.ratt) with ordinality y(p, n);
    loop
      select jsonb_agg(p -> 1 order by random()) into brickor
        from jsonb_array_elements(q.ratt) p;
      varv := varv + 1;
      exit when brickor is distinct from ratt or varv >= 6;
    end loop;
    return jsonb_build_object('id', q.id, 'typ', q.typ, 'fraga', q.fraga,
      'vanster', (select jsonb_agg(p -> 0 order by n) from jsonb_array_elements(q.ratt) with ordinality y(p, n)),
      'hoger', brickor);
  end if;
  loop
    select jsonb_agg(b order by random()) into brickor
      from jsonb_array_elements(q.ratt || coalesce(q.alternativ, '[]'::jsonb)) b;
    varv := varv + 1;
    exit when brickor is distinct from q.ratt or varv >= 6;
  end loop;
  return jsonb_build_object('id', q.id, 'typ', q.typ, 'fraga', q.fraga, 'brickor', brickor);
end $$;

-- ---------- frågorna till ett mästarprov och en repetition ----------
-- Mästarprovet: högst tio frågor ur områdets vanliga nivåer, i ny
-- ordning varje gång. Nivåer med lästext står utanför: deras frågor
-- handlar om en text som provet inte visar.
create or replace function intern.nexlax_mastarfragor(n public.nivaer)
returns uuid[]
language sql
volatile
as $$
  select array_agg(x.id order by x.r)
    from (select q.id, random() as r
            from public.niva_fragor q
            join public.nivaer m on m.id = q.niva_id
           where m.amne = n.amne and m.arskurs = n.arskurs and m.omrade = n.omrade
             and m.sort = 'vanlig' and m.aktiv and m.lastext is null and q.aktiv
           order by r
           limit 10) x
$$;

-- Repetitionen: de frågor i banan som eleven svarade fel på första
-- gången SENAST den fick dem, senaste missen först, högst åtta. En
-- fråga som sedan satt direkt, i vilket försök som helst, är inte
-- längre missad. Räcker de inte fylls försöket på med frågor ur nivåer
-- eleven klarat: repetition av det man kan är också repetition. Allt
-- blandas, så att det missade inte alltid kommer först.
create or replace function intern.nexlax_repetitionsfragor(n public.nivaer, p_elev uuid)
returns uuid[]
language plpgsql
volatile
as $$
declare
  v_miss uuid[];
  v_fyll uuid[];
begin
  with senast as (
    select distinct on (s.fraga_id) s.fraga_id, s.ratt, s.besvarad_at
      from public.niva_svar s
      join public.niva_forsok f on f.id = s.forsok_id
     where f.student_id = p_elev and s.forsta
     order by s.fraga_id, s.besvarad_at desc, s.id desc)
  select array_agg(x.fraga_id order by x.besvarad_at desc) into v_miss
    from (select se.fraga_id, se.besvarad_at
            from senast se
            join public.niva_fragor q on q.id = se.fraga_id and q.aktiv
            join public.nivaer m on m.id = q.niva_id
           where not se.ratt and m.amne = n.amne and m.arskurs = n.arskurs
             and m.sort = 'vanlig' and m.aktiv and m.lastext is null
           order by se.besvarad_at desc
           limit 8) x;

  if coalesce(cardinality(v_miss), 0) < 8 then
    select array_agg(y.id) into v_fyll
      from (select q.id
              from public.niva_fragor q
              join public.nivaer m on m.id = q.niva_id
             where q.aktiv and m.aktiv and m.sort = 'vanlig' and m.lastext is null
               and m.amne = n.amne and m.arskurs = n.arskurs
               and not (q.id = any (coalesce(v_miss, '{}'::uuid[])))
               and exists (select 1 from public.niva_forsok g
                            where g.student_id = p_elev and g.niva_id = m.id and g.godkand)
             order by random()
             limit 8 - coalesce(cardinality(v_miss), 0)) y;
  end if;

  return (select array_agg(z order by random())
            from unnest(coalesce(v_miss, '{}'::uuid[]) || coalesce(v_fyll, '{}'::uuid[])) z);
end $$;

-- ---------- starta en nivå ----------
-- Som i Fas 23.1, med två tillägg: mästarprovet och repetitionen drar
-- sina frågor här, och nivåns sort och lästext följer med ut.
create or replace function public.niva_starta(p_niva uuid, p_elev uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_niva   public.nivaer;
  v_forsok public.niva_forsok;
  v_fragor uuid[];
  v_idag   int;
begin
  if auth.uid() is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.students s where s.id = p_elev and s.parent_id = auth.uid()) then
    raise exception 'Eleven hör inte till ert konto.' using errcode = '42501';
  end if;

  select * into v_niva from public.nivaer where id = p_niva and aktiv;
  if not found then
    raise exception 'Nivån finns inte längre.' using errcode = 'P0002';
  end if;

  select * into v_forsok from public.niva_forsok
   where niva_id = p_niva and student_id = p_elev and klar_at is null
     and startad_at > now() - interval '1 day'
   order by startad_at desc
   limit 1;

  if not found then
    -- Ett tak, så att en slinga inte kan fylla tabellen. Ett barn som
    -- gör hundra nivåer på ett dygn har redan gjort tillräckligt.
    select count(*) into v_idag from public.niva_forsok
     where student_id = p_elev and startad_at > now() - interval '1 day';
    if v_idag >= 100 then
      raise exception 'Det har blivit väldigt många nivåer i dag. Ta en paus och fortsätt i morgon.'
        using errcode = '54000';
    end if;

    if v_niva.sort = 'mastare' then
      v_fragor := intern.nexlax_mastarfragor(v_niva);
    elsif v_niva.sort = 'repetition' then
      v_fragor := intern.nexlax_repetitionsfragor(v_niva, p_elev);
    else
      select array_agg(f.id order by f.ordning, f.id) into v_fragor
        from public.niva_fragor f where f.niva_id = p_niva and f.aktiv;
    end if;
    if v_fragor is null then
      raise exception '%', case v_niva.sort
          when 'repetition' then 'Det finns inget att repetera än. Gör klart en nivå i banan först.'
          when 'mastare' then 'Området har inga frågor än.'
          else 'Nivån har inga frågor än.' end
        using errcode = 'P0002';
    end if;

    insert into public.niva_forsok (niva_id, student_id, fragor, startad_av)
    values (p_niva, p_elev, v_fragor, auth.uid())
    returning * into v_forsok;

    perform set_config('nextrum.niva_rattning', '1', true);
    update public.homework set status = 'pagaende'
     where student_id = p_elev and niva_id = p_niva and status = 'ej_paborjad';
    perform set_config('nextrum.niva_rattning', '', true);
  end if;

  return jsonb_build_object(
    'forsok', v_forsok.id,
    'niva', jsonb_build_object('id', v_niva.id, 'titel', v_niva.titel, 'amne', v_niva.amne,
                               'omrade', v_niva.omrade, 'arskurs', v_niva.arskurs,
                               'sort', v_niva.sort, 'lastext', v_niva.lastext),
    'fragor', (select jsonb_agg(intern.niva_fraga_ut(f) order by u.nr)
                 from unnest(v_forsok.fragor) with ordinality u(id, nr)
                 join public.niva_fragor f on f.id = u.id),
    'klara', (select coalesce(jsonb_agg(distinct s.fraga_id), '[]'::jsonb)
                from public.niva_svar s where s.forsok_id = v_forsok.id and s.ratt));
end $$;

-- ---------- XP-reglerna ----------
-- Det man väljer bland färdiga svar ger 10, det man skriver, bygger
-- eller parar ihop själv ger 20. Står också i nexlax_lage().regler, som
-- vyerna förklarar reglerna ur.
create or replace function intern.nexlax_vikt(p_typ text)
returns int
language sql
immutable
as $$
  select case p_typ when 'val' then 10 else 20 end
$$;

-- XP för en fråga i ett försök: vikten om det första rätta förstasvaret
-- någonsin på frågan står i just det försöket, annars noll. Samma svar
-- varje gång det frågas, så ett nytt anrop efter ett nätfel ger samma
-- besked.
create or replace function intern.nexlax_fraga_xp(p_elev uuid, p_fraga uuid, p_forsok uuid)
returns int
language sql
stable
as $$
  select case when (
      select s.forsok_id
        from public.niva_svar s
        join public.niva_forsok f on f.id = s.forsok_id
       where f.student_id = p_elev and s.fraga_id = p_fraga and s.forsta and s.ratt
       order by s.besvarad_at, s.id
       limit 1) = p_forsok
    then coalesce((select intern.nexlax_vikt(q.typ) from public.niva_fragor q where q.id = p_fraga), 0)
    else 0 end
$$;

-- När ett område blev klart för eleven, eller null. Klart är när varje
-- aktiv vanlig nivå i området som FANNS då (created_at) var klarad.
-- En nivå som läggs till senare tar alltså inte tillbaka de 100 XP.
create or replace function intern.nexlax_omrade_klart(p_elev uuid, p_amne text, p_arskurs text, p_omrade text)
returns timestamptz
language sql
stable
as $$
  with klara as (
    select g.niva_id, min(g.klar_at) as klar_at
      from public.niva_forsok g
      join public.nivaer m on m.id = g.niva_id
     where g.student_id = p_elev and g.godkand and m.sort = 'vanlig'
       and m.amne = p_amne and m.arskurs = p_arskurs and m.omrade = p_omrade
     group by g.niva_id)
  select min(k.klar_at)
    from klara k
   where not exists (
     select 1 from public.nivaer m
      where m.amne = p_amne and m.arskurs = p_arskurs and m.omrade = p_omrade
        and m.sort = 'vanlig' and m.aktiv and m.created_at <= k.klar_at
        and not exists (select 1 from klara k2 where k2.niva_id = m.id and k2.klar_at <= k.klar_at))
$$;

-- Varje XP-händelse för en elev: frågan, nivån och området, med tid och
-- var den hör hemma. nexlax_lage() summerar dem.
create or replace function intern.nexlax_handelser(p_elev uuid)
returns table (sort text, xp int, at timestamptz, niva_id uuid, amne text, arskurs text, omrade text)
language sql
stable
as $$
  select * from (
    select distinct on (s.fraga_id)
           'fraga'::text, intern.nexlax_vikt(q.typ), s.besvarad_at, q.niva_id, m.amne, m.arskurs, m.omrade
      from public.niva_svar s
      join public.niva_forsok f on f.id = s.forsok_id
      join public.niva_fragor q on q.id = s.fraga_id
      join public.nivaer m on m.id = q.niva_id
     where f.student_id = p_elev and s.forsta and s.ratt
     order by s.fraga_id, s.besvarad_at, s.id) a
  union all
  select * from (
    select distinct on (f.niva_id)
           'niva'::text, 50, f.klar_at, f.niva_id, m.amne, m.arskurs, m.omrade
      from public.niva_forsok f
      join public.nivaer m on m.id = f.niva_id
     where f.student_id = p_elev and f.godkand
     order by f.niva_id, f.klar_at, f.id) b
  union all
  select 'omrade'::text, 100, t.klart, null::uuid, o.amne, o.arskurs, o.omrade
    from (select distinct m.amne, m.arskurs, m.omrade
            from public.niva_forsok f
            join public.nivaer m on m.id = f.niva_id
           where f.student_id = p_elev and f.godkand and m.sort = 'vanlig') o
    cross join lateral (select intern.nexlax_omrade_klart(p_elev, o.amne, o.arskurs, o.omrade) as klart) t
   where t.klart is not null
$$;

-- ---------- svara ----------
-- Som i Fas 23.1, och svaret säger dessutom hur mycket XP det gav:
-- xp för svaret, och när nivån blir klar xp_fragor (försökets frågor),
-- xp_niva (50 första gången nivån klaras) och xp_omrade (100 när det
-- klarade området). Samma svar två gånger ger samma besked.
create or replace function public.niva_svara(p_forsok uuid, p_fraga uuid, p_svar jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  f          public.niva_forsok;
  q          public.niva_fragor;
  n          public.nivaer;
  v_ratt     boolean;
  v_forsta   boolean;
  v_klar     boolean;
  v_direkt   int;
  v_antal    int;
  v_stj      int;
  v_forut    int;
  v_xp       int;
  v_xp_frag  int := 0;
  v_xp_niva  int := 0;
  v_xp_omr   int := 0;
begin
  if auth.uid() is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;

  select * into f from public.niva_forsok where id = p_forsok for update;
  if not found or not exists (
      select 1 from public.students s where s.id = f.student_id and s.parent_id = auth.uid()) then
    raise exception 'Försöket hör inte till ert konto.' using errcode = '42501';
  end if;
  if not (p_fraga = any (f.fragor)) then
    raise exception 'Frågan hör inte till nivån.' using errcode = '22023';
  end if;
  if p_svar is null or length(p_svar::text) > 2000 then
    raise exception 'Svaret är för långt.' using errcode = '22023';
  end if;

  select * into q from public.niva_fragor where id = p_fraga;

  if f.klar_at is not null
     or exists (select 1 from public.niva_svar where forsok_id = f.id and fraga_id = q.id and ratt) then
    v_ratt := exists (select 1 from public.niva_svar where forsok_id = f.id and fraga_id = q.id and ratt);
  else
    if (select count(*) from public.niva_svar where forsok_id = f.id) >= cardinality(f.fragor) * 10 then
      raise exception 'Det har blivit för många svar på den här nivån. Börja om den.' using errcode = '54000';
    end if;
    v_ratt := intern.niva_ratta(q, p_svar);
    v_forsta := not exists (select 1 from public.niva_svar where forsok_id = f.id and fraga_id = q.id);
    insert into public.niva_svar (forsok_id, fraga_id, svar, ratt, forsta)
    values (f.id, q.id, p_svar, v_ratt, v_forsta);
  end if;

  if f.klar_at is null then
    select count(distinct fraga_id) = cardinality(f.fragor) into v_klar
      from public.niva_svar where forsok_id = f.id and ratt;

    if v_klar then
      v_antal := cardinality(f.fragor);
      select count(*) into v_direkt from public.niva_svar where forsok_id = f.id and forsta and ratt;
      v_stj := case when v_direkt = v_antal then 3
                    when v_direkt * 5 >= v_antal * 4 then 2
                    when v_direkt * 5 >= v_antal * 3 then 1
                    else 0 end;
      update public.niva_forsok
         set klar_at = clock_timestamp(), antal = v_antal, ratt_direkt = v_direkt,
             stjarnor = v_stj, godkand = v_stj >= 1
       where id = f.id
       returning * into f;

      if v_stj >= 1 then
        perform set_config('nextrum.niva_rattning', '1', true);
        update public.homework set status = 'klar'
         where student_id = f.student_id and niva_id = f.niva_id and status <> 'klar';
        perform set_config('nextrum.niva_rattning', '', true);
      end if;
    end if;
  else
    v_klar := true;
  end if;

  v_xp := intern.nexlax_fraga_xp(f.student_id, q.id, f.id);

  if v_klar then
    select coalesce(max(stjarnor), 0) into v_forut from public.niva_forsok
     where student_id = f.student_id and niva_id = f.niva_id and klar_at is not null
       and id <> f.id and klar_at < f.klar_at;

    select coalesce(sum(intern.nexlax_fraga_xp(f.student_id, u.id, f.id)), 0) into v_xp_frag
      from unnest(f.fragor) u(id);
    if f.godkand and (select g.id from public.niva_forsok g
                       where g.student_id = f.student_id and g.niva_id = f.niva_id and g.godkand
                       order by g.klar_at, g.id limit 1) = f.id then
      v_xp_niva := 50;
      select * into n from public.nivaer where id = f.niva_id;
      if n.sort = 'vanlig'
         and intern.nexlax_omrade_klart(f.student_id, n.amne, n.arskurs, n.omrade) = f.klar_at then
        v_xp_omr := 100;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ratt', v_ratt,
    'facit', intern.niva_facit(q),
    'forklaring', q.forklaring,
    'klar', v_klar,
    'xp', v_xp,
    'resultat', case when v_klar then jsonb_build_object(
        'antal', f.antal, 'ratt_direkt', f.ratt_direkt, 'stjarnor', f.stjarnor,
        'godkand', f.godkand, 'forut', v_forut, 'klar_at', f.klar_at,
        'xp_fragor', v_xp_frag, 'xp_niva', v_xp_niva, 'xp_omrade', v_xp_omr) end);
end $$;

-- ---------- läget i NexLäx ----------
-- XP, serien och det som behövs för att rita utvecklingen, för en elev.
-- Familjen, elevens studiehjälpare och admin, som försöken. Räknar i
-- databasen: totalen hade annars krävt att vyn hämtat varje svar, och
-- familjen läser inte frågornas typ (niva_fragor har ingen policy för
-- dem). Dagarna räknas i svensk tid.
create or replace function public.nexlax_lage(p_elev uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_idag   date := (now() at time zone 'Europe/Stockholm')::date;
  v_ut     jsonb;
  v_serie  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;
  if not (exists (select 1 from public.students s where s.id = p_elev and s.parent_id = auth.uid())
          or public.is_my_student(p_elev) or public.is_admin()) then
    raise exception 'Eleven hör inte till er.' using errcode = '42501';
  end if;

  -- Dagarna med något gjort, och serierna av dem.
  with aktiva as (
    select distinct d from (
      select (f.klar_at at time zone 'Europe/Stockholm')::date as d
        from public.niva_forsok f where f.student_id = p_elev and f.klar_at is not null
      union all
      select (h.completed_at at time zone 'Europe/Stockholm')::date
        from public.homework h where h.student_id = p_elev and h.status = 'klar' and h.completed_at is not null
      union all
      select r.lesson_date
        from public.lesson_reports r
       where r.student_id = p_elev and r.narvaro is distinct from 'franvarande' and r.lesson_date <= v_idag
    ) x),
  oar as (
    select d, d - (row_number() over (order by d))::int as grupp from aktiva),
  serier as (
    select max(d) as till, count(*)::int as langd from oar group by grupp)
  select jsonb_build_object(
      'nu', coalesce((select s.langd from serier s where s.till >= v_idag - 1 order by s.till desc limit 1), 0),
      'basta', coalesce((select max(s.langd) from serier s), 0),
      'idag', exists (select 1 from aktiva a where a.d = v_idag))
    into v_serie;

  with h as (select * from intern.nexlax_handelser(p_elev)),
  dag as (
    select (h.at at time zone 'Europe/Stockholm')::date as d, sum(h.xp)::int as xp
      from h group by 1),
  gjort as (
    select d, sum(nivaer)::int as nivaer, sum(uppgifter)::int as uppgifter, sum(pass)::int as pass from (
      select (f.klar_at at time zone 'Europe/Stockholm')::date as d, 1 as nivaer, 0 as uppgifter, 0 as pass
        from public.niva_forsok f where f.student_id = p_elev and f.klar_at is not null
      union all
      select (h2.completed_at at time zone 'Europe/Stockholm')::date, 0, 1, 0
        from public.homework h2 where h2.student_id = p_elev and h2.status = 'klar' and h2.completed_at is not null
      union all
      select r.lesson_date, 0, 0, 1
        from public.lesson_reports r
       where r.student_id = p_elev and r.narvaro is distinct from 'franvarande' and r.lesson_date <= v_idag
    ) x
     where d > v_idag - 84
     group by d),
  svar as (
    select s.fraga_id, s.ratt, s.forsta
      from public.niva_svar s join public.niva_forsok f on f.id = s.forsok_id
     where f.student_id = p_elev),
  senast as (
    select distinct on (s.fraga_id) s.fraga_id, s.ratt
      from public.niva_svar s join public.niva_forsok f on f.id = s.forsok_id
     where f.student_id = p_elev and s.forsta
     order by s.fraga_id, s.besvarad_at desc, s.id desc)
  select jsonb_build_object(
    'xp', coalesce((select sum(xp) from h), 0),
    'xp_idag', coalesce((select xp from dag where d = v_idag), 0),
    'xp_vecka', coalesce((select sum(xp) from dag where d >= date_trunc('week', v_idag)::date), 0),
    'serie', v_serie,
    'dagar', coalesce((
      select jsonb_agg(jsonb_build_object('dag', k.d, 'xp', coalesce(dag.xp, 0),
                                          'nivaer', coalesce(g.nivaer, 0), 'uppgifter', coalesce(g.uppgifter, 0),
                                          'pass', coalesce(g.pass, 0)) order by k.d)
        from (select d from dag where d > v_idag - 84 union select d from gjort) k
        left join dag on dag.d = k.d
        left join gjort g on g.d = k.d), '[]'::jsonb),
    'banor', coalesce((
      select jsonb_agg(jsonb_build_object('amne', amne, 'arskurs', arskurs, 'xp', xp) order by xp desc)
        from (select amne, arskurs, sum(xp)::int as xp from h group by amne, arskurs) b), '[]'::jsonb),
    'nivaer', coalesce((
      select jsonb_object_agg(niva_id, jsonb_build_object('xp', xp, 'direkt', direkt))
        from (select niva_id, sum(xp)::int as xp, count(*) filter (where sort = 'fraga')::int as direkt
                from h where niva_id is not null group by niva_id) x), '{}'::jsonb),
    'omraden', coalesce((
      select jsonb_agg(jsonb_build_object('amne', amne, 'arskurs', arskurs, 'omrade', omrade, 'klart', at) order by at)
        from h where sort = 'omrade'), '[]'::jsonb),
    'missade', coalesce((
      select jsonb_agg(jsonb_build_object('amne', amne, 'arskurs', arskurs, 'antal', antal))
        from (select m.amne, m.arskurs, count(*)::int as antal
                from senast se
                join public.niva_fragor q on q.id = se.fraga_id and q.aktiv
                join public.nivaer m on m.id = q.niva_id
               where not se.ratt and m.sort = 'vanlig' and m.aktiv and m.lastext is null
               group by m.amne, m.arskurs) x), '[]'::jsonb),
    'uppgifter', jsonb_build_object(
      'klara', (select count(distinct fraga_id) from svar where ratt),
      'direkt', (select count(*) from h where sort = 'fraga'),
      'forsta', (select count(*) from svar where forsta),
      'forsta_ratt', (select count(*) from svar where forsta and ratt)),
    'regler', jsonb_build_object('val', intern.nexlax_vikt('val'), 'svarare', intern.nexlax_vikt('skriv'),
                                 'niva', 50, 'omrade', 100),
    'idag', v_idag)
  into v_ut;

  return v_ut;
end $$;

-- ---------- rättigheterna ----------
revoke execute on function intern.niva_ratta(public.niva_fragor, jsonb), intern.niva_fraga_ut(public.niva_fragor),
  intern.nexlax_mastarfragor(public.nivaer), intern.nexlax_repetitionsfragor(public.nivaer, uuid),
  intern.nexlax_vikt(text), intern.nexlax_fraga_xp(uuid, uuid, uuid),
  intern.nexlax_omrade_klart(uuid, text, text, text), intern.nexlax_handelser(uuid)
  from public, anon, authenticated;

revoke execute on function public.niva_starta(uuid, uuid), public.niva_svara(uuid, uuid, jsonb),
  public.nexlax_lage(uuid) from public, anon;
grant execute on function public.niva_starta(uuid, uuid), public.niva_svara(uuid, uuid, jsonb),
  public.nexlax_lage(uuid) to authenticated;

comment on function public.niva_starta(uuid, uuid) is
  'Startar eller fortsätter en nivå för ett av familjens barn och lämnar ut frågorna utan facit. '
  'Mästarprovet och repetitionen drar sina frågor här (Fas 23.1, 23.2).';
comment on function public.niva_svara(uuid, uuid, jsonb) is
  'Rättar ett svar i databasen, avslutar nivån när allt är rätt besvarat och säger hur mycket XP det gav (Fas 23.1, 23.2).';
comment on function public.nexlax_lage(uuid) is
  'XP, serien i dagar och underlaget för utvecklingen i NexLäx, räknat ur svaren och försöken (Fas 23.2).';
