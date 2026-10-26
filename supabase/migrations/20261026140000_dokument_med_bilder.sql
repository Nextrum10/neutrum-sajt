-- ============================================================
-- NEXTRUM — ett dokument kan vara skärmdumpar (2026-10-26)
--
-- Leo: "i dokument på plattformen ska admin kunna lägga in
-- skärmdumpar från mobil, mac eller liknande, istället för text.
-- alltså antingen text eller bild, eller både och."
--
-- Förut var en handling en fil ELLER en inklistrad text
-- (avtal_som_text). En bild gick att ladda upp, men bara en, som en
-- fil, och aldrig ihop med en text. Ett avtal som skrivits i en chatt
-- eller ett mejl är oftast tre skärmdumpar, och de skulle först
-- klistras ihop till en PDF.
--
-- Nu är en handling en fil, ELLER en text och/eller bilder: kolumnen
-- bilder är en lista med sökvägar i hinken dokument, i den ordning
-- de ska läsas. En fil och bilder utesluter varandra, som en fil och
-- en text: en fil är ett eget dokument, bilderna hör till texten.
--
-- BILDERNA ÄNDRAS INTE, SOM TEXTEN. Ett avtal motparten har läst får
-- inte bytas under hen (avtal_som_text). Sökvägarna skrivs därför
-- när raden skapas, innan filerna laddas upp: vyn väljer handlingens
-- id själv, och hinkpolicyn släpper in en uppladdning till en mapp
-- vars handling finns. Efter det byts listan aldrig, inte ens av
-- admin. En ny version är en ny handling.
--
-- VARJE BILD LIGGER I HANDLINGENS EGEN MAPP, med ett nummer och inget
-- filnamn: <id>/1.png, <id>/2.jpg. Ett filnamn från en telefon säger
-- ingenting, och ett från en dator kan säga vem avtalet gäller. Och
-- policyn som släpper in personen till en bild prövar hela sökvägen:
-- en bild i en annan handlings mapp hade annars kunnat listas här och
-- bli läsbar för fel person.
--
-- PERSONEN SER HANDLINGEN FÖRST NÄR BILDERNA FINNS. Vyn skapar raden
-- odelad, laddar upp och delar sist. En uppladdning som avbryts mitt
-- i lämnar en rad bara vi ser, aldrig ett avtal med hål i hos familjen.
--
-- mina_handlingar() FÅR INGEN KOLUMN TILL. Returtypen kan inte ändras
-- utan ett drop (avtal_som_text). Listan tar nu med en handling med
-- bara bilder, och mina_handlingar_bilder() säger vilka av raderna som
-- har bilder, och var de ligger. Texten hämtas som förut, med
-- min_handling_text(), när personen trycker Läs.
--
-- AUDITEN LOGGAR INTE BILDERNA, som den inte loggar texten
-- (handlingar_audit har en vitlista).
--
-- Ingen sats i filen river något: villkor och triggrar skapas efter
-- en kontroll, och mina_handlingar() lappas med replace() och en vakt,
-- så att filen går att köra två gånger (minne/databasen.md).
-- ============================================================

alter table public.handlingar
  add column if not exists bilder text[];

comment on column public.handlingar.bilder is
  'Skärmdumparna i en handling, sökvägar i hinken dokument i läsordning: <id>/<nummer>.png, .jpg eller .webp. '
  'Skrivs när handlingen skapas och ändras aldrig (handlingar_bilderna). Ihop med en text eller ensamma, '
  'aldrig med en fil. Personen läser dem genom mina_handlingar_bilder() och policyn "personen läser sitt '
  'dokument". Står aldrig i auditloggen.';

do $$
begin
  -- En fil, eller en text och bilder. En fil ihop med bilder hade
  -- varit två dokument på en rad.
  if not exists (select 1 from pg_constraint
                  where conname = 'handlingar_fil_eller_bilder'
                    and conrelid = 'public.handlingar'::regclass) then
    alter table public.handlingar
      add constraint handlingar_fil_eller_bilder check (fil is null or bilder is null);
  end if;
  -- Minst en bild när listan finns, och ett tak: tjugo skärmdumpar är
  -- ett långt avtal, och fler är en PDF.
  if not exists (select 1 from pg_constraint
                  where conname = 'handlingar_bilder_antal'
                    and conrelid = 'public.handlingar'::regclass) then
    alter table public.handlingar
      add constraint handlingar_bilder_antal check (
        bilder is null or (cardinality(bilder) between 1 and 20 and array_position(bilder, null) is null));
  end if;
end $$;


-- ---------- bilderna står fast, i handlingens egen mapp ----------
create or replace function intern.handling_bilderna()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.bilder is distinct from old.bilder then
    raise exception 'Bilderna i ett dokument byts inte. Lägg till dem som ett nytt dokument och ta bort det gamla.'
      using errcode = 'check_violation';
  end if;
  if new.bilder is not null then
    if exists (select 1 from unnest(new.bilder) b
                where b !~ ('^' || new.id::text || '/[0-9]{1,2}\.(png|jpg|webp)$')) then
      raise exception 'En bild i ett dokument ligger i dokumentets egen mapp, som <id>/<nummer>.png, .jpg eller .webp.'
        using errcode = 'check_violation';
    end if;
    if (select count(distinct b) from unnest(new.bilder) b) <> cardinality(new.bilder) then
      raise exception 'Samma bild står två gånger i dokumentet.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
revoke all on function intern.handling_bilderna() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'handlingar_bilderna'
                    and tgrelid = 'public.handlingar'::regclass
                    and not tgisinternal) then
    create trigger handlingar_bilderna
      before insert or update on public.handlingar
      for each row execute function intern.handling_bilderna();
  end if;
end $$;


-- ---------- hinken släpper in personen till bilderna ----------
-- Samma prövning som filen (dokument_delas_med_personen): hela
-- sökvägen, i handlingens egen mapp, och bara en delad handling.
create or replace function intern.handling_delad_med_mig(p_namn text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.handlingar h
     where h.id = public.mapp_uuid(p_namn)
       and (h.fil = p_namn or p_namn = any (h.bilder))
       and h.delad_med_personen
       and h.kopplad_tabell = 'profiles'
       and h.kopplad_id = (select auth.uid())::text)
$$;
revoke execute on function intern.handling_delad_med_mig(text) from public, anon;
grant execute on function intern.handling_delad_med_mig(text) to authenticated;


-- ---------- personens lista tar med bilderna ----------
-- Lappas med replace() och en vakt, som i avtal_som_text. Är lappen
-- redan gjord (filen körs en andra gång) görs ingenting.
do $$
declare
  def    text;
  n      int;
  gammal constant text := 'and (h.fil is not null or h.innehall is not null)';
  ny     constant text := 'and (h.fil is not null or h.innehall is not null or h.bilder is not null)';
begin
  def := pg_get_functiondef('public.mina_handlingar()'::regprocedure);
  if position(ny in def) > 0 then
    return;
  end if;
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if n <> 1 then
    raise exception 'public.mina_handlingar har % rader "%", väntat en', n, gammal;
  end if;
  execute replace(def, gammal, ny);
end $$;

comment on function public.mina_handlingar() is
  'Handlingarna som delats med den inloggade, utan anteckningen. '
  'En rad utan fil är en text och/eller bilder: texten läses med min_handling_text(id), '
  'bilderna står i mina_handlingar_bilder().';


-- ---------- vilka av personens handlingar som har bilder ----------
-- En rad per delad handling med bilder: om den också har en text,
-- och sökvägarna i läsordning. Sökvägarna är ingen hemlighet för den
-- som får läsa filerna, och hinken prövar varje öppning för sig.
create or replace function public.mina_handlingar_bilder()
returns table (id uuid, har_text boolean, bilder text[])
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.innehall is not null, h.bilder
    from public.handlingar h
   where h.delad_med_personen
     and h.kopplad_tabell = 'profiles'
     and h.kopplad_id = (select auth.uid())::text
     and h.bilder is not null
   order by h.uppladdad desc
$$;
revoke execute on function public.mina_handlingar_bilder() from public, anon;
grant execute on function public.mina_handlingar_bilder() to authenticated;

comment on function public.mina_handlingar_bilder() is
  'Bilderna i de handlingar som delats med den inloggade (dokument_med_bilder): id, om texten finns, '
  'och sökvägarna i läsordning. Bara den inloggades egna, delade handlingar.';
