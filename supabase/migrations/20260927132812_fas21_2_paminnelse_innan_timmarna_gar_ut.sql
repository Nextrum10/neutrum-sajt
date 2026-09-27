-- ============================================================
-- Fas 21.2 — familjen påminns tio dagar innan timmarna går ut
--
-- Leo 2026-09-27: "påminn innan timmarna går ut, 10 dagar innan".
--
-- Villkoren säger att timmar som finns kvar när tiden gått ut förfaller,
-- och att familjen ska höra av sig innan dess om de inte hinner. Utan en
-- påminnelse fick familjen själv komma ihåg ett datum som bara stod i
-- vyn, och en plan på fyra timmar i en månad tappar en timme på en
-- sjukvecka. Nu går ett mejl tio dagar innan sista dagen, en gång per
-- kort och sista dag.
--
--
-- EN NY NOTISTYP, timmar_gar_ut
--
-- De fem stegen i DEPLOY-NOTISER.md avsnitt 5: typen i notis_typer()
-- och notis_mejlbara() här, samma sträng i _delad/notiser/typer.ts, en
-- mall i mallar.ts och en rad i NOTISVAL i nextrum-studie.js, så att
-- familjen kan stänga av den under Profil → Notiser.
--
-- Mallen ser bara RenData. Den här typen lägger till EN nyckel, kvar
-- (ett heltal), och återanvänder datum för sista dagen. Kortets id
-- följer med i data för att dubbletterna ska gå att känna igen här, men
-- renData() läser det aldrig.
--
--
-- VARFÖR ETT EGET SCHEMA OCH INTE notis_planera()
--
-- notis_planera() körs varje minut och går igenom passen. Den här
-- frågan gäller köp, inte pass, och räcker att ställa en gång i timmen.
-- Ett eget jobb lämnar notis_planera orörd. Mejlet går bara ut mellan
-- 9 och 20 svensk tid: en påminnelse om köpta timmar är inte bråttom,
-- och den ska inte komma klockan tre på natten.
--
-- Missas en timme, eller en dag, går mejlet vid nästa körning så länge
-- sista dagen inte passerat: fönstret är de tio sista dagarna, inte en
-- enda dag. Ett kort som flyttar sitt sista datum (admin) får en ny
-- påminnelse för det nya datumet.
-- ============================================================

create or replace function public.notis_typer()
returns text[] language sql immutable set search_path = public as $$
  select array['pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
               'meddelande', 'rapport', 'paminnelse', 'timmar_gar_ut']
$$;

create or replace function public.notis_mejlbara()
returns text[] language sql immutable set search_path = public as $$
  select array['pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
               'meddelande', 'paminnelse', 'timmar_gar_ut']
$$;

/* p_nu finns för proven i rls-test.sql: tidsfönstret 9–20 hade annars
   gjort att proven gick igenom eller föll beroende på när de kördes.
   Schemat anropar utan argument. */
create function intern.timmar_gar_ut_koa(p_nu timestamptz default now())
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  idag  date := (p_nu at time zone 'Europe/Stockholm')::date;
  timme int  := extract(hour from p_nu at time zone 'Europe/Stockholm')::int;
  -- Hur många dagar före sista dagen. Leo 2026-09-27.
  dagar constant int := 10;
  k     record;
  data  jsonb;
  nya   int := 0;
begin
  if timme < 9 or timme >= 20 then
    return 0;
  end if;

  for k in
    select s.id, s.parent_id, s.kvar, s.giltigt_till
      from public.klippkort_saldo s
     where s.status = 'betald'
       and s.kvar > 0
       and s.giltigt_till between idag and idag + dagar
  loop
    continue when exists (
      select 1 from public.notiser n
       where n.mottagare = k.parent_id and n.typ = 'timmar_gar_ut'
         and n.data ->> 'klippkort' = k.id::text
         and n.data ->> 'datum' = k.giltigt_till::text);

    data := jsonb_build_object('datum', k.giltigt_till, 'kvar', k.kvar, 'klippkort', k.id);

    insert into public.notiser (mottagare, typ, trad_parent, data)
    values (k.parent_id, 'timmar_gar_ut', k.parent_id, data);
    nya := nya + 1;

    if public.notis_vill(k.parent_id, 'timmar_gar_ut', 'mejl') then
      -- Sista chansen att skicka är sista dagens slut: efter det är
      -- påminnelsen om timmar som redan förfallit.
      perform intern.notis_koa(k.parent_id, 'mejl', 'timmar_gar_ut', null, k.parent_id, null, data, null,
        'timmar_gar_ut:mejl:' || k.parent_id || ':' || k.id || ':' || k.giltigt_till,
        p_nu, ((k.giltigt_till + 1)::timestamp at time zone 'Europe/Stockholm'));
    end if;
  end loop;
  return nya;
end $$;

revoke all on function intern.timmar_gar_ut_koa(timestamptz) from public, anon, authenticated;

comment on function intern.timmar_gar_ut_koa(timestamptz) is
  'Fas 21.2. Köar påminnelsen timmar_gar_ut tio dagar innan ett betalt kort med timmar kvar går ut. En gång per kort och sista dag. Körs av pg_cron timmar-gar-ut.';

select cron.schedule('timmar-gar-ut', '7 * * * *', $$select intern.timmar_gar_ut_koa()$$);

-- ---------- provmejlet ----------
-- Knappen Skicka provmejl går igenom alla mejlbara typer med samma
-- exempeldata. Utan kvar hade provet av den nya typen sagt "timmar
-- kvar" utan ett tal, och ingen hade sett hur det riktiga ser ut.
do $$
declare
  fore   text := pg_get_functiondef('public.notis_provmejl'::regproc);
  gammal text := $g$'timmar', 24);$g$;
  ny     text := $n$'timmar', 24, 'kvar', 3);$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'notis_provmejl: exempeldatan hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;
