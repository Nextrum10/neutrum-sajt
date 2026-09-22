-- ============================================================
-- NEXTRUM — program 2, Fas 2.3c: en påminnelse per mottagare
--
-- Idempotensnyckeln för påminnelserna saknade mottagaren. Familjen och
-- studiehjälparen fick samma nyckel för samma pass, och den andra
-- insättningen föll på "on conflict do nothing": bara en av dem hade
-- fått mejlet (och SMS:et). RLS-sviten (R2 2.3) fångade det innan
-- något schemalagts. Nyckeln bär nu mottagaren. Resten av funktionen
-- är ordagrant densamma som i 2.3.
-- ============================================================

create or replace function public.notis_planera()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inst   public.notis_installning%rowtype;
  h      int;
  b      record;
  paminn timestamptz;
  m      uuid;
  bas    jsonb;
  data   jsonb;
  elev   text;
  hjalp  text;
  nya    int := 0;
begin
  select * into inst from public.notis_installning where id = 1;
  if inst.paminnelser_timmar is null or cardinality(inst.paminnelser_timmar) = 0 then
    return 0;
  end if;

  foreach h in array inst.paminnelser_timmar loop
    for b in
      select bk.id, bk.parent_id, bk.tutor_id, bk.student_id, bk.wanted_date, bk.wanted_time,
             bk.duration_min, bk.subject, bk.created_at,
             (bk.wanted_date + bk.wanted_time::time) at time zone 'Europe/Stockholm' as start
        from public.bookings bk
       where bk.status = 'confirmed'
         and bk.wanted_time is not null
         and bk.wanted_date between (now() at time zone 'Europe/Stockholm')::date - 1
                                and (now() at time zone 'Europe/Stockholm')::date + 8
    loop
      paminn := b.start - make_interval(hours => h);
      continue when paminn > now()                          -- inte dags än
                 or b.start <= now()                        -- passet har börjat
                 or paminn < now() - interval '30 minutes'  -- för sent, cron har stått still
                 or b.created_at > paminn;                  -- bokat efter påminnelsetiden

      select intern.fornamn(s.name) into elev from public.students s where s.id = b.student_id;
      select intern.fornamn(p.full_name) into hjalp from public.profiles p where p.id = b.tutor_id;
      bas := jsonb_strip_nulls(jsonb_build_object(
        'datum', b.wanted_date, 'tid', b.wanted_time, 'langd_min', b.duration_min,
        'amne', intern.fornamn(b.subject), 'studiehjalpare', hjalp, 'timmar', h, 'start', b.start));

      foreach m in array array[b.parent_id, b.tutor_id] loop
        continue when m is null;
        data := case when elev is not null and intern.far_se_eleven(m, b.student_id)
                     then bas || jsonb_build_object('elev', elev) else bas end;

        if not exists (select 1 from public.notiser n
                        where n.pass_id = b.id and n.mottagare = m and n.typ = 'paminnelse'
                          and n.data ->> 'timmar' = h::text and (n.data ->> 'start')::timestamptz = b.start) then
          insert into public.notiser (mottagare, typ, pass_id, elev_id, trad_parent, trad_tutor, data)
          values (m, 'paminnelse', b.id, b.student_id, b.parent_id, b.tutor_id, data);
          nya := nya + 1;
        end if;

        if public.notis_vill(m, 'paminnelse', 'mejl') then
          perform intern.notis_koa(m, 'mejl', 'paminnelse', b.id, b.parent_id, b.tutor_id, data, null,
            'paminnelse:mejl:' || m || ':' || b.id || ':' || h || ':' || extract(epoch from b.start)::bigint,
            now(), b.start);
        end if;
        if public.notis_vill(m, 'paminnelse', 'sms') then
          perform intern.notis_koa(m, 'sms', 'paminnelse', b.id, b.parent_id, b.tutor_id, data, null,
            'paminnelse:sms:' || m || ':' || b.id || ':' || h || ':' || extract(epoch from b.start)::bigint,
            now(), b.start);
        end if;
      end loop;
    end loop;
  end loop;
  return nya;
end $$;
