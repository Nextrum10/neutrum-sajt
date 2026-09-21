-- ============================================================
-- NEXTRUM — program 2, Fas 2.3d: arbetaren får mottagaren, och
-- provmejlet kan visa studiehjälparens mejl
--
-- 1. Avregistreringslänken i varje mejl är signerad för mottagarens
--    id. notis_utskick_ta lämnade inte ut det, så arbetaren fick läsa
--    notis_utskick en gång till. Nu står mottagaren i svaret.
-- 2. Provmejlen gick alltid som familj, eftersom den som provar är
--    admin och admins konto är ett familjekonto. notis_provmejl tar nu
--    rollen (parent eller tutor) och arbetaren renderar provet för den.
--    Rollen gäller bara rader märkta prov; ett riktigt utskick får
--    alltid mottagarens egen roll.
--
-- Returtypen ändras, så funktionerna tas bort och skapas igen. Allt
-- annat i dem är ordagrant som i 2.3b och 2.3.
-- ============================================================

drop function if exists public.notis_utskick_ta(int);
drop function if exists public.notis_provmejl();

create function public.notis_utskick_ta(p_max int default 25)
returns table (id uuid, mottagare uuid, kanal text, typ text, antal int, data jsonb, roll text, fornamn text,
               epost text, telefon text, till_sandlada boolean, sms_lage text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u        record;
  drift    public.notis_drift%rowtype;
  mejl_pa  boolean := public.flagga_pa('notiser_mejl');
  sms_pa   boolean := public.flagga_pa('notiser_sms');
  prov     boolean;
  skal     text;
  adress   text;
  nummer   text;
  sms_idag int;
begin
  select * into drift from public.notis_drift d where d.id = 1;

  -- Lån som gått ut: arbetaren dog mitt i. Tillbaka i kön, utom där
  -- en nyare rad redan väntar på samma samlingsnyckel; då tar den
  -- över (och Resends idempotensnyckel skyddar om den förra hann gå).
  update public.notis_utskick q set status = 'hoppad', fel = 'ersatt av ett nyare utskick', lanad_till = null,
         uppdaterad = now()
   where q.status = 'skickar' and q.lanad_till < now() and q.samlingsnyckel is not null
     and exists (select 1 from public.notis_utskick v
                  where v.samlingsnyckel = q.samlingsnyckel and v.status = 'vantar');
  update public.notis_utskick q set status = 'vantar', lanad_till = null, uppdaterad = now()
   where q.status = 'skickar' and q.lanad_till < now();

  select count(*) into sms_idag from public.notis_utskick q
   where q.kanal = 'sms' and q.status = 'skickad' and q.uppdaterad > now() - interval '24 hours';

  for u in
    select q.* from public.notis_utskick q
     where q.status = 'vantar' and q.skicka_efter <= now()
     order by q.skicka_efter
     limit greatest(1, least(coalesce(p_max, 25), 100))
     for update skip locked
  loop
    prov := coalesce((u.data ->> 'prov')::boolean, false);
    skal := null;

    if u.skicka_senast is not null and u.skicka_senast < now() then
      skal := 'för sent';
    elsif not prov and not public.notis_vill(u.mottagare, u.typ, u.kanal) then
      skal := 'avstängt av mottagaren';
    elsif u.typ = 'paminnelse' and not prov and not exists (
            select 1 from public.bookings b
             where b.id = u.pass_id and b.status = 'confirmed'
               and (b.wanted_date + b.wanted_time::time) at time zone 'Europe/Stockholm'
                   = (u.data ->> 'start')::timestamptz) then
      skal := 'passet är inte längre bokat på den tiden';
    elsif u.typ = 'meddelande' and not prov and not exists (
            select 1 from public.notiser n
             where n.mottagare = u.mottagare and n.typ = 'meddelande' and n.last_at is null
               and n.trad_parent = u.trad_parent and n.trad_tutor = u.trad_tutor) then
      skal := 'redan läst i appen';
    elsif u.typ like 'pass\_%' and not prov and u.pass_id is null then
      skal := 'passet finns inte längre';
    end if;

    if skal is not null then
      update public.notis_utskick q set status = 'hoppad', fel = skal, uppdaterad = now() where q.id = u.id;
      continue;
    end if;

    adress := null;
    nummer := null;
    if u.kanal = 'mejl' then
      if prov or mejl_pa then
        select a.email into adress from auth.users a where a.id = u.mottagare;
      elsif drift.mejl_sandlada is not null then
        adress := drift.mejl_sandlada;
      else
        update public.notis_utskick q set status = 'loggad', uppdaterad = now() where q.id = u.id;
        continue;
      end if;
      if adress is null then
        update public.notis_utskick q set status = 'fel', fel = 'mottagaren saknar e-postadress', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;
    else
      if not sms_pa then
        update public.notis_utskick q set status = 'loggad', uppdaterad = now() where q.id = u.id;
        continue;
      end if;
      if sms_idag >= drift.sms_tak_per_dygn then
        update public.notis_utskick q set status = 'hoppad', fel = 'dygnstaket för SMS är nått', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;
      select intern.sms_nummer(p.phone) into nummer from public.profiles p where p.id = u.mottagare;
      if nummer is null then
        update public.notis_utskick q set status = 'hoppad', fel = 'inget giltigt mobilnummer', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;
      sms_idag := sms_idag + 1;
    end if;

    update public.notis_utskick q
       set status = 'skickar', lanad_till = now() + interval '5 minutes', forsok = q.forsok + 1,
           till_sandlada = (u.kanal = 'mejl' and not prov and not mejl_pa), uppdaterad = now()
     where q.id = u.id;

    return query
      select u.id, u.mottagare, u.kanal, u.typ, u.antal, u.data,
             case when prov and u.data ->> 'prov_roll' in ('parent', 'tutor') then u.data ->> 'prov_roll'
                  when p.role = 'tutor' then 'tutor' else 'parent' end,
             intern.fornamn(p.full_name), adress, nummer,
             (u.kanal = 'mejl' and not prov and not mejl_pa), drift.sms_lage
        from public.profiles p where p.id = u.mottagare;
  end loop;
end $$;

create function public.notis_provmejl(p_roll text default 'parent')
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t text;
  n int := 0;
  exempel jsonb := jsonb_build_object(
    'prov', true, 'datum', (now() at time zone 'Europe/Stockholm')::date + 1, 'tid', '16:00',
    'langd_min', 60, 'amne', 'Matematik', 'elev', 'Alva', 'studiehjalpare', 'Tove', 'fran', 'Tove',
    'fran_datum', (now() at time zone 'Europe/Stockholm')::date + 2, 'fran_tid', '15:00', 'timmar', 24);
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum kan skicka provmejl.';
  end if;
  if p_roll not in ('parent', 'tutor') then
    raise exception using errcode = '22023', message = 'Välj familj eller studiehjälpare.';
  end if;
  exempel := exempel || jsonb_build_object('prov_roll', p_roll);
  foreach t in array public.notis_mejlbara() loop
    perform intern.notis_koa(auth.uid(), 'mejl', t, null, null, null, exempel, null,
      'prov:' || p_roll || ':' || t || ':' || gen_random_uuid(), now(), now() + interval '1 hour');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.notis_utskick_ta(int) from public, anon, authenticated;
grant execute on function public.notis_utskick_ta(int) to service_role;
revoke execute on function public.notis_provmejl(text) from public, anon;
grant execute on function public.notis_provmejl(text) to authenticated;
