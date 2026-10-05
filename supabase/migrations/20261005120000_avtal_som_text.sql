-- ============================================================
-- NEXTRUM — ett avtal klistras in som text
--
-- Leo 2026-10-05: "avtalen som skrivs ska kunna kopplas till
-- användare också, dvs föräldrar vilket innebör att jag ska kunna
-- klistra in avtal som lagras hos mig och hos de. avtalet ska kunna
-- namges hur som helst"
--
-- Kopplingen till en person fanns sedan dokument_delas_med_personen
-- (2026-09-29), men bara för en fil: ett avtal som skrevs i ett mejl
-- eller ett dokument måste sparas som PDF innan det kunde delas. Nu är
-- en handling en fil ELLER en text, aldrig båda. Titeln är fri text
-- som förut; sorten (typ) är den fasta listan.
--
-- TEXTEN ÄNDRAS INTE. Ett avtal motparten har läst får inte bytas
-- under hen. En ny version är en ny handling, och den gamla tas bort
-- för sig. Adminvyn byter inte heller en fil, men en fil går inte att
-- skriva om med en UPDATE, och det går en text: därför står regeln här,
-- i en trigger, och inte bara i vyn.
--
-- PERSONEN LÄSER TEXTEN GENOM EN EGEN FUNKTION. mina_handlingar() kan
-- inte få en kolumn till utan att tas bort först (returtypen ändras),
-- och listan ska inte bära hela avtal. Texten hämtas när personen
-- trycker Läs, genom min_handling_text(), som svarar bara den
-- inloggade och bara om en delad handling. mina_handlingar() tar nu
-- med en handling med text: fil är null på den raden, och det är så
-- vyn vet att den är en text (villkoret nedan gör att det inte kan
-- betyda något annat).
--
-- AUDITEN LOGGAR INTE TEXTEN. handlingar_audit har en vitlista, och
-- innehall står inte i den: aldrig titel, filnamn eller anteckning
-- (Fas 9.10), och inte heller ett avtals text.
--
-- Ingen sats i filen river något: villkor och trigger skapas efter en
-- kontroll, så att filen går att köra två gånger (minne/databasen.md).
-- ============================================================

alter table public.handlingar
  add column if not exists innehall text;

comment on column public.handlingar.innehall is
  'Avtalets text, när handlingen klistrats in i stället för att laddas upp. '
  'Skrivs när handlingen skapas och ändras aldrig (handlingar_texten_star_fast). '
  'Personen läser den genom min_handling_text(). Står aldrig i auditloggen.';

do $$
begin
  -- En fil eller en text. Båda hade gjort det oklart vilken av dem
  -- personen läst, och vilken som är avtalet.
  if not exists (select 1 from pg_constraint
                  where conname = 'handlingar_fil_eller_text'
                    and conrelid = 'public.handlingar'::regclass) then
    alter table public.handlingar
      add constraint handlingar_fil_eller_text check (fil is null or innehall is null);
  end if;
  -- En tom text är ingen handling, och ett tak så att en felklistrad
  -- sida inte blir en rad på megabyte. 200 000 tecken är ett avtal på
  -- sextio sidor. Inte btrim(): den tar bara mellanslag, och en text
  -- av radbrytningar hade gått igenom.
  if not exists (select 1 from pg_constraint
                  where conname = 'handlingar_innehall_langd'
                    and conrelid = 'public.handlingar'::regclass) then
    alter table public.handlingar
      add constraint handlingar_innehall_langd check (
        innehall is null or (innehall ~ '[^[:space:]]' and length(innehall) <= 200000));
  end if;
end $$;


-- ---------- texten står fast ----------
create or replace function intern.handling_texten_star_fast()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.innehall is distinct from old.innehall then
    raise exception 'Ett avtals text ändras inte. Lägg till den nya texten som en ny handling och ta bort den gamla.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function intern.handling_texten_star_fast() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'handlingar_texten_star_fast'
                    and tgrelid = 'public.handlingar'::regclass
                    and not tgisinternal) then
    create trigger handlingar_texten_star_fast
      before update on public.handlingar
      for each row execute function intern.handling_texten_star_fast();
  end if;
end $$;


-- ---------- personens lista tar med texterna ----------
-- Lappas med replace() och en vakt, som i dokument_delas_med_personen:
-- skrivs inte om ur en kopia. En handling utan fil och utan text står
-- fortfarande inte med: den finns bara medan adminvyn laddar upp. Är
-- lappen redan gjord (filen körs en andra gång) görs ingenting.
do $$
declare
  def    text;
  n      int;
  gammal constant text := 'and h.fil is not null';
  ny     constant text := 'and (h.fil is not null or h.innehall is not null)';
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
  'En rad utan fil är en text: den läses med min_handling_text(id).';


-- ---------- personen läser texten ----------
-- Svarar null för allt som inte är den inloggades delade handling: en
-- annans, en odelad, en som inte finns. Vyn säger då att texten inte
-- gick att hämta, och ingen kan pröva sig fram till vad som finns.
create or replace function public.min_handling_text(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select h.innehall
    from public.handlingar h
   where h.id = p_id
     and h.delad_med_personen
     and h.kopplad_tabell = 'profiles'
     and h.kopplad_id = (select auth.uid())::text
$$;
revoke execute on function public.min_handling_text(uuid) from public, anon;
grant execute on function public.min_handling_text(uuid) to authenticated;

comment on function public.min_handling_text(uuid) is
  'Texten i en handling som delats med den inloggade (avtal_som_text). Null för allt annat.';
