-- ============================================================
-- NEXTRUM — ett dokument delas med personen det gäller
--
-- Leo 2026-09-29: "i admin, system och dokument. man ska kunna spara
-- dokument där och välja vilken person som ska ha tillgång till det
-- genom sina inställningar. dvs anställningsavtal med lärare eller
-- annat avtal med kund."
--
-- Fas 9.10 byggde handlingar som admin ensam. Kolumnerna för vem en
-- handling gäller fanns redan (kopplad_tabell, kopplad_id), och
-- raderingsrutan läser dem, men ingen vy satte dem. Nu väljer admin
-- personen under System → Dokument, och kolumnen nedan säger om
-- personen ser dokumentet under Profil & inställningar → Dokument i
-- sin egen vy.
--
-- EN PERSON, INTE EN LISTA. Ett avtal har en motpart. Det som ska nå
-- alla studiehjälpare (en handbok, en policy) är en annan regel, och
-- byggs den dag den behövs.
--
-- PERSONEN LÄSER INTE TABELLEN. RLS kan inte begränsa kolumner, och
-- handlingar har anteckning, som är vår. mina_handlingar() lämnar ut
-- en fast kolumnlista, bara för den inloggade själv. Tabellen har
-- fortfarande bara adminpolicyerna.
--
-- HINKEN SLÄPPER IN EXAKT DEN FIL RADEN PEKAR UT. Sökvägen börjar med
-- handlingens id, men policyn kräver hela sökvägen: en fil som hamnat
-- i samma mapp blir inte personens för att den ligger där. Prövningen
-- görs av en SECURITY DEFINER-funktion i intern. Policyn körs som
-- personen, som inte ser handlingar, och ett villkor som anropar en
-- funktion kräver EXECUTE hos anroparen (Fas 10).
--
-- RADERINGSRUTAN RÄKNADE BARA STUDIEHJÄLPARENS HANDLINGAR. En familj
-- kunde inte ha några förut. Nu kan den, och rutan ska säga att
-- avtalet står kvar under System → Dokument när familjen raderas:
-- annars tror admin att allt om familjen är borta. Funktionen lappas
-- med replace() och en vakt, som i personer_redigeras_och_raderas,
-- och skrivs inte om ur en kopia.
-- ============================================================

alter table public.handlingar
  add column if not exists delad_med_personen boolean not null default false;

comment on column public.handlingar.delad_med_personen is
  'Personen i kopplad_id ser handlingen under Profil & inställningar → Dokument, '
  'genom mina_handlingar() och policyn "personen läser sitt dokument". '
  'Kräver kopplad_tabell = profiles.';

-- Ett konto-id skrivs som auth.uid() skriver det. Versaler eller ett
-- mellanslag hade gjort att jämförelsen i funktionerna nedan aldrig
-- träffar: delningen hade sett gjord ut i adminvyn utan att nå någon,
-- och raderingsrutan hade inte räknat dokumentet.
alter table public.handlingar
  drop constraint if exists handlingar_person_id;
alter table public.handlingar
  add constraint handlingar_person_id check (
    kopplad_tabell is distinct from 'profiles'
    or (kopplad_id is not null
        and kopplad_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));

-- Bara en person kan se en handling. En handling om ett barn, ett
-- uppdrag eller en faktura har ingen som loggar in och läser den.
alter table public.handlingar
  drop constraint if exists handlingar_delas_med_en_person;
alter table public.handlingar
  add constraint handlingar_delas_med_en_person check (
    not delad_med_personen or coalesce(kopplad_tabell, '') = 'profiles');


-- ---------- personens egen lista ----------
-- Svarar bara om den inloggade. En handling utan fil står inte med:
-- den finns bara medan adminvyn laddar upp, och en rad som inte går
-- att öppna är ingen handling.
create or replace function public.mina_handlingar()
returns table (id uuid, typ text, titel text, fil text, mimetyp text, storlek bigint,
               giltig_fran date, giltig_till date, uppladdad timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.typ, h.titel, h.fil, h.mimetyp, h.storlek, h.giltig_fran, h.giltig_till, h.uppladdad
    from public.handlingar h
   where h.delad_med_personen
     and h.kopplad_tabell = 'profiles'
     and h.kopplad_id = (select auth.uid())::text
     and h.fil is not null
   order by h.uppladdad desc
$$;
revoke execute on function public.mina_handlingar() from public, anon;
grant execute on function public.mina_handlingar() to authenticated;


-- ---------- hinken ----------
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
       and h.fil = p_namn
       and h.delad_med_personen
       and h.kopplad_tabell = 'profiles'
       and h.kopplad_id = (select auth.uid())::text)
$$;
revoke execute on function intern.handling_delad_med_mig(text) from public, anon;
grant execute on function intern.handling_delad_med_mig(text) to authenticated;

-- Läsa, inget annat. Personen laddar inte upp, byter inte och tar inte
-- bort: det är vårt dokument, och personen har en kopia.
drop policy if exists "personen läser sitt dokument" on storage.objects;
create policy "personen läser sitt dokument" on storage.objects
  for select to authenticated
  using (bucket_id = 'dokument' and intern.handling_delad_med_mig(storage.objects.name));


-- ---------- auditloggen ----------
-- Att en handling delas står i loggen: vem som gav vem tillgång, och
-- när. Titeln, filnamnet och anteckningen står fortfarande inte där
-- (Fas 9.10).
drop trigger if exists handlingar_audit on public.handlingar;
create trigger handlingar_audit
  after insert or update or delete on public.handlingar
  for each row execute function public.logga_andring(
    'handling', 'id', 'typ', 'kopplad_tabell', 'kopplad_id',
    'giltig_fran', 'giltig_till', 'uppladdad_av', 'delad_med_personen');


-- ---------- raderingsrutan ----------
-- Familjens står_kvar hade bara det som hör till bokföringen, och bara
-- när familjen avidentifieras. Handlingarna står kvar i båda fallen,
-- som studiehjälparens: det är admin som tar bort ett avtal, inte
-- raderingen.
do $$
declare
  def    text;
  n      int;
  gammal constant text := E'''fakturor'', (select count(*) from public.invoices i where i.parent_id = p_id));\n    end if;';
  ny     constant text := E'''fakturor'', (select count(*) from public.invoices i where i.parent_id = p_id));\n    end if;'
    || E'\n    -- Avtalen med familjen (dokument_delas_med_personen) står kvar'
    || E'\n    -- under System → Dokument, som studiehjälparens.'
    || E'\n    kvar := kvar || jsonb_build_object('
    || E'\n      ''handlingar'', (select count(*) from public.handlingar h'
    || E'\n                      where h.kopplad_tabell = ''profiles'' and h.kopplad_id = p_id::text));';
begin
  def := pg_get_functiondef('intern.radering_underlag(text, uuid)'::regprocedure);
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if n <> 1 then
    raise exception 'intern.radering_underlag har % rader "%", väntat en', n, gammal;
  end if;
  execute replace(def, gammal, ny);
end $$;
