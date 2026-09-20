-- ============================================================
-- NEXTRUM — Fas 8.6: människan godkänner, servern utför
--
-- Det här är den enda platsen där ett AI-förslag blir en ändring i
-- verksamheten, och den är med flit skriven i SQL och inte i en
-- edge-funktion. Skälet är att funktionen anropas med ADMINENS EGEN
-- token:
--   · auth.uid() är satt, så skydda_*-triggrarna gör sitt vanliga
--     jobb och logga_andring skriver rätt aktör
--   · RLS gäller som för vilken adminknapp som helst
-- En edge-funktion med service_role hade tappat alla tre på en gång,
-- och då hade "AI:n föreslog, en människa godkände" varit en mening
-- i ett gränssnitt i stället för något som står i loggen.
--
-- EN GREN PER TYP, ALDRIG EN GENERISK UPPDATERING.
-- payload läses bara av den gren som hör till typen. Ett generiskt
-- "update <tabell> set <payload>" hade gjort payload till en
-- kommandorad, och payload kommer från en modell som läser text som
-- vem som helst har skrivit.
--
-- ALLT ELLER INGET.
-- Utförandet och statusbytet sker i samma transaktion. Faller
-- ändringen på en trigger eller ett villkor rullas allt tillbaka och
-- förslaget står kvar som föreslaget — det finns inget läge där
-- någon måste minnas att köra klart något.
--
-- LOGGEN SKÖTER SIG SJÄLV.
-- Två auditrader skrivs utan att den här funktionen skriver dem:
-- ai_forslag_audit när förslaget byter status, och affärstabellens
-- egen trigger när raden ändras. Båda bär aktören som tryckte. Vi
-- lägger inte till en tredje rad som säger samma sak en gång till.
-- ============================================================

-- Kopplingen ska synas i loggen: utan den går det inte att se VILKEN
-- elev ett godkänt matchningsförslag gällde.
drop trigger if exists ai_forslag_audit on public.ai_forslag;
create trigger ai_forslag_audit
  after insert or delete or update on public.ai_forslag
  for each row execute function public.logga_andring(
    'ai_forslag', 'id', 'typ', 'status', 'nyckel', 'korning_id', 'beslutad_av',
    'kopplad_tabell', 'kopplad_id');

create or replace function public.godkann_forslag(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  f        public.ai_forslag%rowtype;
  elev     uuid;
  hjalpare uuid;
  pass     uuid;
  lead_id  uuid;
  nystatus text;
  rader    integer;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum godkänner förslag.';
  end if;

  -- Låset gör att två flikar inte kan godkänna samma förslag två
  -- gånger. Den andra får vänta, ser 'utford' och avbryter.
  select * into f from public.ai_forslag where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Förslaget finns inte.';
  end if;
  if f.status <> 'foreslagen' then
    raise exception using errcode = '22023',
      message = 'Förslaget är redan avgjort (' || f.status || ').';
  end if;

  case f.typ

    when 'matchning' then
      elev := nullif(f.payload ->> 'elev_id', '')::uuid;
      hjalpare := nullif(f.payload ->> 'studiehjalpare_id', '')::uuid;
      if elev is null or hjalpare is null then
        raise exception using errcode = '22023', message = 'Förslaget saknar elev eller studiehjälpare.';
      end if;
      if not exists (select 1 from public.tutor_profiles t
                      where t.id = hjalpare and t.status = 'approved') then
        raise exception using errcode = '22023',
          message = 'Studiehjälparen är inte godkänd längre. Förslaget utfördes inte.';
      end if;

      update public.students
         set matched_tutor_id = hjalpare,
             match_status = 'matched'
       where id = elev;
      get diagnostics rader = row_count;
      if rader = 0 then
        raise exception using errcode = '22023', message = 'Eleven finns inte längre.';
      end if;

    when 'pass_ej_fakturerbart' then
      pass := nullif(f.payload ->> 'pass_id', '')::uuid;
      if pass is null then
        raise exception using errcode = '22023', message = 'Förslaget saknar pass.';
      end if;
      update public.bookings
         set fakturerbar = false,
             fakturerbar_anledning = left(coalesce(f.payload ->> 'anledning',
               'Undantaget efter AI-förslag.'), 200)
       where id = pass;
      get diagnostics rader = row_count;
      if rader = 0 then
        raise exception using errcode = '22023', message = 'Passet finns inte längre.';
      end if;

    when 'lead_status' then
      lead_id := nullif(f.payload ->> 'lead_id', '')::uuid;
      nystatus := f.payload ->> 'status';
      if lead_id is null or nystatus not in ('new', 'contacted', 'matched', 'declined') then
        raise exception using errcode = '22023', message = 'Förslaget har ingen giltig status för anmälan.';
      end if;
      update public.leads set status = nystatus where id = lead_id;
      get diagnostics rader = row_count;
      if rader = 0 then
        raise exception using errcode = '22023', message = 'Anmälan finns inte längre.';
      end if;

    else
      raise exception using errcode = '22023',
        message = 'Typen ' || f.typ || ' har ingen väg att utföras. Lägg till en gren i godkann_forslag.';
  end case;

  update public.ai_forslag
     set status = 'utford',
         beslutad_av = auth.uid(),
         beslutad = now(),
         utford = now(),
         fel = null
   where id = p_id;

  return jsonb_build_object('id', p_id, 'typ', f.typ, 'status', 'utford');
end $$;

comment on function public.godkann_forslag(uuid) is
  'Utför ett AI-förslag, med adminens egen token så att triggrar och auditlogg fungerar som vanligt. En gren per typ.';

create or replace function public.avvisa_forslag(p_id uuid, p_anledning text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  f public.ai_forslag%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum avgör förslag.';
  end if;

  select * into f from public.ai_forslag where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Förslaget finns inte.';
  end if;
  if f.status <> 'foreslagen' then
    raise exception using errcode = '22023',
      message = 'Förslaget är redan avgjort (' || f.status || ').';
  end if;

  -- Ett avvisat förslag kommer inte tillbaka: nyckeln är upptagen
  -- för alltid. Det är skillnaden mot en uppgift, som får återkomma.
  update public.ai_forslag
     set status = 'avvisad',
         beslutad_av = auth.uid(),
         beslutad = now(),
         fel = left(p_anledning, 2000)
   where id = p_id;

  return jsonb_build_object('id', p_id, 'typ', f.typ, 'status', 'avvisad');
end $$;

revoke execute on function public.godkann_forslag(uuid) from public, anon;
revoke execute on function public.avvisa_forslag(uuid, text) from public, anon;
grant execute on function public.godkann_forslag(uuid) to authenticated;
grant execute on function public.avvisa_forslag(uuid, text) to authenticated;
