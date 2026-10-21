#!/bin/bash
# ============================================================
# Två betalningar av samma skuld samtidigt (syskontillagg_som_skuld,
# 2026-10-21).
#
# rls-test.sql kör i en transaktion och kan inte pröva två samtidiga.
# Här öppnar två psql-sessioner var sitt betalningsförsök för samma
# familj med samma upplupna poster: A låser dem och håller transaktionen
# öppen i tre sekunder, B startar under tiden. B ska vänta på A och sedan
# inte få en enda post (en betalning pågår), och varje post ska stå i
# exakt ett försök. Sedan samma sak med två köp av timmar.
#
# Körs mot den lokala databasen (verktyg/lokal-databas.sh), aldrig mot
# driften: fixturerna skrivs på riktigt och städas bort sist med
# session_replication_role = replica, för posterna raderas annars aldrig.
#
#   PORT=54329 bash verktyg/prova-tillagg-samtidigt.sh
# ============================================================
set -u
PORT="${PORT:-54329}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
P="psql -h localhost -p $PORT -U postgres -d postgres -X -A -t -q -v ON_ERROR_STOP=1"
UT=$(mktemp -d "${TMPDIR:-/tmp}/samtidigt.XXXXXX")

F=00000000-0000-4000-8000-0000005130f1
T=00000000-0000-4000-8000-0000005130a1
S1=00000000-0000-4000-8000-0000005130c1
S2=00000000-0000-4000-8000-0000005130c2
K1=00000000-0000-4000-8000-0000005130d1
K2=00000000-0000-4000-8000-0000005130d2

stada() {
  $P <<SQL > /dev/null 2>&1
set session_replication_role = replica;
delete from public.tillagg_forsok_poster where forsok_id in (select id from public.tillagg_forsok where familj = '$F');
delete from public.tillagg_poster where familj_id = '$F';
delete from public.tillagg_forsok where familj = '$F';
delete from public.bokning_barn where bokning_id in (select id from public.bookings where parent_id = '$F');
delete from public.bookings where parent_id = '$F';
delete from public.klippkort where parent_id = '$F';
delete from public.tillagg_godkannanden where familj = '$F';
delete from public.students where parent_id = '$F';
delete from public.villkor_godkannanden where anvandare in ('$F', '$T');
delete from public.notis_utskick where mottagare in ('$F', '$T') or trad_parent = '$F';
delete from public.notiser where mottagare in ('$F', '$T') or trad_parent = '$F';
delete from public.tutor_profiles where id = '$T';
delete from public.profiles where id in ('$F', '$T');
delete from auth.users where id in ('$F', '$T');
set session_replication_role = origin;
SQL
}
trap 'stada; rm -rf "$UT"' EXIT
stada

# Läget före: flaggorna och inställningarna som de var, så att de kan läggas tillbaka.
FORE=$($P -c "select (select villkor_version from public.tillagg_installning where id = 1) || ' '
  || (select aktiv from public.flaggor where kod = 'syskonskuld') || ' '
  || (select aktiv from public.flaggor where kod = 'erbjudanden')")

$P <<SQL || { echo "fixturerna gick inte att skriva"; exit 1; }
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('$F', 'samtidigt-f@example.invalid', '{"role":"parent","full_name":"Samtidig Familj"}'),
  ('$T', 'samtidigt-t@example.invalid', '{"role":"tutor","full_name":"Samtidig Hjälpare"}');
update public.tillagg_installning set villkor_version = '2026-10-21' where id = 1;
update public.flaggor set aktiv = true where kod in ('syskonskuld', 'erbjudanden');
insert into public.tillagg_godkannanden (familj, version) values ('$F', '2026-10-21');
insert into public.villkor_godkannanden (anvandare, version, kalla) values ('$F', intern.villkor_version(), 'registrering');
insert into public.students (id, parent_id, name) values ('$S1', '$F', 'Ett'), ('$S2', '$F', 'Två');
insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min,
                             status, extra_barn)
select '$F', '$T', '$S1', '$F', (now() at time zone 'Europe/Stockholm')::date - d, '12:00', 60, 'confirmed', array['$S2']::uuid[]
  from generate_series(1, 3) d;
update public.bookings set status = 'completed' where parent_id = '$F';
insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                              timpris_ore, begart_ore, status)
select x.id, '$F', e.kod, e.namn, e.sort, e.timmar, e.giltig_manader, e.rabatt_procent, e.timpris_ore, e.pris_ore, 'vantar'
  from public.erbjudanden_pris e, (values ('$K1'::uuid), ('$K2'::uuid)) x(id) where e.kod = 'plan_basic';
commit;
SQL

fel=0
prova() {
  local namn="$1" a="$2" b="$3"
  # Posterna tillbaka till upplupen inför varje varv.
  $P -c "select public.tillagg_forsok_slapp(id, 'avbruten') from public.tillagg_forsok
          where familj = '$F' and status = 'oppen'" > /dev/null
    ( $P -c "begin; select public.tillagg_forsok_skapa('$F', $a); select pg_sleep(3); commit;" > "$UT/a.txt" 2>&1 ) &
  local pa=$!
  sleep 0.5
  local bstart; bstart=$(date +%s%3N)
  $P -c "begin; select public.tillagg_forsok_skapa('$F', $b); commit;" > "$UT/b.txt" 2>&1
  local bslut; bslut=$(date +%s%3N)
  wait $pa
  local vantade=$(( bslut - bstart ))
  local svar
  svar=$($P -c "select
      (select count(*) from public.tillagg_poster where familj_id = '$F' and status = 'i_betalning'),
      (select count(distinct betalningsforsok_id) from public.tillagg_poster where familj_id = '$F' and status = 'i_betalning'),
      (select count(*) from public.tillagg_forsok f where f.familj = '$F' and f.status = 'oppen'
         and exists (select 1 from public.tillagg_poster t where t.betalningsforsok_id = f.id)),
      (select count(*) from (select fp.post_id from public.tillagg_forsok_poster fp
                               join public.tillagg_forsok f on f.id = fp.forsok_id
                              where f.familj = '$F' and f.status = 'oppen'
                              group by fp.post_id having count(*) > 1) x)" | tr '|' ' ')
  local bsvar; bsvar=$(grep -o '"forsok": [^,]*\|"pagar": [a-z]*\|"aterbruk": [a-z]*' "$UT/b.txt" | tr '\n' ' ')
  # Tre poster låsta, i ett enda öppet försök, ingen post i två, och B väntade på A.
  if [ "$svar" = "3 1 1 0" ] && [ "$vantade" -gt 2000 ]; then
    echo "ok    $namn: tre poster i ett försök, B väntade $vantade ms och fick: $bsvar"
  else
    echo "FEL   $namn: $svar (låsta, försök med poster, öppna med poster, poster i två), B väntade $vantade ms: $bsvar"
    cat "$UT/a.txt" "$UT/b.txt"
    fel=1
  fi
}

prova "två flikar med Betala tillägg nu" "'manuell'" "'manuell'"
prova "Betala tillägg nu och ett köp samtidigt" "'manuell'" "'kop', '$K1'"
prova "två köp samtidigt" "'kop', '$K1'" "'kop', '$K2'"

# Tillbaka som det var.
read -r V S E <<< "$FORE"
$P -c "update public.flaggor set aktiv = $S where kod = 'syskonskuld';
       update public.flaggor set aktiv = $E where kod = 'erbjudanden';
       update public.tillagg_installning set villkor_version = '$V' where id = 1;" > /dev/null 2>&1 \
  || $P -c "update public.flaggor set aktiv = false where kod = 'syskonskuld';
            update public.tillagg_installning set villkor_version = '$V' where id = 1;
            update public.flaggor set aktiv = $E where kod = 'erbjudanden';" > /dev/null
[ $fel = 0 ] && echo "SAMTIDIGT: GRÖNT" || echo "SAMTIDIGT: RÖTT"
exit $fel
