-- ============================================================
-- NEXTRUM — program 2, Fas 1.3: upptagna tider
--
-- Bokningen visade varje timme i studiehjälparens fönster som ledig,
-- också den som en annan familj redan hade. Krocken upptäcktes först
-- när passet sparades (bookings_ingen_overlapp), och familjen fick
-- ett fel i stället för att aldrig ha erbjudits tiden.
--
-- Orsaken låg i driften, inte i koden. NX.hämtaUpptagna läser vyn
-- tutor_busy_slots, och den vyn har i driften security_invoker och
-- ingen SELECT för anon eller authenticated — återkallat utanför
-- alla migrationer i repot. Frågan föll, felet svaldes, och svaret
-- blev en tom mängd för alla. Också för studiehjälparen själv.
--
-- Att ge tillbaka SELECT på vyn hjälper inte: med invoker ser
-- familjen bara sina egna pass. Att stänga av invoker lämnar ut
-- varje studiehjälpares schema till vem som helst, vilket var läget
-- i schema-v9. Därför en funktion som svarar på exakt en fråga:
-- vilka timmar är tagna hos DEN HÄR studiehjälparen. Den säger
-- aldrig av vem, för vilket barn eller var.
--
-- VEM FÅR FRÅGA: studiehjälparen om sig själv, admin, och en familj
-- om sin egen matchade studiehjälpare. Grinden är matchningen, aldrig
-- profiles.role — rollen kommer ur registreringens metadata, som den
-- som registrerar sig skriver själv.
--
-- EN RAD PER TIMME, inte per pass. Vyn gav bara starttiden, så ett
-- tvåtimmarspass 16:00 spärrade aldrig 17:00.
-- ============================================================

create or replace function public.upptagna_tider(p_tutor uuid, p_fran date, p_till date)
returns table (datum date, tid text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Logga in för att se tiderna.';
  end if;
  if not (p_tutor = auth.uid() or public.is_admin() or public.is_my_matched_tutor(p_tutor)) then
    raise exception using errcode = '42501',
      message = 'Du kan bara se tiderna hos din egen studiehjälpare.';
  end if;
  if p_fran is null or p_till is null or p_till < p_fran or p_till - p_fran > 200 then
    raise exception using errcode = '22023', message = 'Välj högst ett halvår i taget.';
  end if;

  return query
    select distinct b.wanted_date,
           lpad((split_part(b.wanted_time, ':', 1)::int + h)::text, 2, '0') || ':00'
      from public.bookings b
     cross join lateral generate_series(0, greatest(1, ceil(b.duration_min / 60.0)::int) - 1) as h
     where b.tutor_id = p_tutor
       and b.status in ('requested', 'confirmed')
       and b.wanted_date between p_fran and p_till
       and b.wanted_time ~ '^[0-9]{1,2}:[0-9]{2}'
     order by 1, 2;
end $$;

revoke execute on function public.upptagna_tider(uuid, date, date) from public, anon;
grant execute on function public.upptagna_tider(uuid, date, date) to authenticated;

comment on function public.upptagna_tider(uuid, date, date) is
  'Tagna timmar hos en studiehjälpare, en rad per timme. Säger aldrig av vem. '
  'Studiehjälparen själv, admin, eller en familj om sin matchade studiehjälpare.';
