-- ============================================================
-- NEXTRUM — en godkänd ansökan gallras två år efter att
-- studiehjälparen slutat
--
-- GDPR art. 5.1 e. Ansökningsgallringen (20260927141154) lät en
-- godkänd ansökan stå för alltid, och skyddsnätet (samma adress som en
-- godkänd studiehjälpare) höll kvar också en ny eller kontaktad ansökan
-- för alltid. Hur länge en studiehjälpares ansökan och CV sparas efter
-- att hen slutat var inte avgjort. Nu är det det:
--
--   * Är personen studiehjälpare hos oss (godkänd profil med samma
--     adress): två år efter senaste aktivitet. Aktivitet är kontot,
--     senaste inloggning, senaste pass som inte avbokats och senaste
--     rapport. Så länge hen arbetar står ansökan kvar.
--   * Godkänd, men inget konto med den adressen: två år efter ansökan
--     eller dess senaste steg.
--   * Allt annat: som förut, ett år, eller trettio dagar efter senaste
--     steget.
--
-- Två år, samma som när ett oanvänt konto blir en uppgift
-- (konton_oanvanda). Det finns ingen status för "har slutat" i
-- tutor_profiles, så aktiviteten ÄR signalen: den som inte haft ett
-- pass, en rapport eller en inloggning på två år har slutat.
--
-- Bara regeln byts. ansokan_gallring_lista, ansokan_gallring_vack och
-- ansokan_gallra läser den och följer med.
-- ============================================================

create or replace function intern.ansokan_gallras_fran(a public.applications)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  with steg as (
    select greatest(a.kontaktad_at, a.mote_tid, a.intervju_at, a.utbildningsmote_at,
                    (a.prov_sista_dag + 1)::timestamp at time zone 'Europe/Stockholm',
                    a.prov_godkant_at, a.utbildad_at) as senast
  ),
  hjalpare as (
    -- Senaste gången studiehjälparen med samma adress var aktiv: kontot,
    -- inloggningen, ett pass som inte avbokats eller en rapport. Bara en
    -- godkänd studiehjälpare räknas, som i skyddsnätet förut.
    select max(greatest(
             t.created_at, p.created_at, p.last_seen_at, u.last_sign_in_at,
             (select max(b.wanted_date)::timestamp at time zone 'Europe/Stockholm'
                from public.bookings b
               where b.tutor_id = t.id and b.status <> 'cancelled'),
             (select max(r.created_at) from public.lesson_reports r where r.tutor_id = t.id)
           )) as senast
      from public.profiles p
      join public.tutor_profiles t on t.id = p.id
      left join auth.users u on u.id = p.id
     where a.status <> 'rejected'
       and t.status = 'approved'
       and intern.epost_nyckel(a.email) <> ''
       and intern.epost_nyckel(p.email) = intern.epost_nyckel(a.email)
  )
  select case
    when h.senast is not null then h.senast + interval '2 years'
    when a.status = 'approved' then greatest(a.created_at, s.senast) + interval '2 years'
    else greatest(a.created_at + interval '1 year', s.senast + interval '30 days')
  end
  from steg s, hjalpare h
$$;
