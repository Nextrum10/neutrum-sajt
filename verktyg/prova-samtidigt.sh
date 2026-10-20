#!/bin/bash
# ============================================================
# NEXTRUM — två samtidiga dragningar ur samma timme (2026-10-21)
#
#   verktyg/prova-samtidigt.sh          bygg en egen databas och prova
#   verktyg/prova-samtidigt.sh prova    prova mot den som står
#
# rls-test.sql är EN transaktion och kan inte pröva lås: där ser varje
# sats allt den själv skrivit. Här tar två sessioner samtidigt den sista
# timmen i familjens timbank, var och en för sitt pass. Den första håller
# låset (klippkort_dra låser passet och alla familjens köp FÖR UPDATE och
# räknar timmarna i en egen sats efteråt) och väntar två sekunder innan
# den committar; den andra ska vänta på låset, se att timmen är tagen och
# säga nej. Utan låset hade båda passen dragit samma timme och saldot
# blivit minus ett.
#
# Databasen är en egen (nextrum-samtidigt på port 54330), byggd av
# verktyg/lokal-databas.sh, så att provets familj aldrig hamnar i den som
# rls-test.sql körs mot. Flaggan erbjudanden står av i den, som i
# rls-test.sql, så att timmarna inte betalar passen av sig själva medan
# fixturen skrivs.
# ============================================================
set -u
cd "$(dirname "$0")/.."
export NAMN="${NAMN:-nextrum-samtidigt}" PORT="${PORT:-54330}" PGPASSWORD=postgres
TMP="${TMPDIR:-/tmp}"
UT="$TMP/$NAMN"
mkdir -p "$UT"

if [ "${1:-}" != "prova" ]; then
  TMPDIR="$TMP" bash verktyg/lokal-databas.sh bygg || exit 1
fi

P="psql -h localhost -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -X -A -t -q"
id() { cat /proc/sys/kernel/random/uuid; }
F=$(id); T=$(id); S=$(id); K=$(id); B1=$(id); B2=$(id)

# ---------- fixturen: en familj med EN timme och två bekräftade pass ----------
$P > "$UT/fixtur.txt" 2>&1 <<SQL || { echo "FEL i fixturen"; cat "$UT/fixtur.txt"; exit 1; }
update public.flaggor set aktiv = false where kod = 'erbjudanden';
insert into auth.users (id, email, raw_user_meta_data) values
  ('$F', 'familj-$F@example.invalid', '{"role":"parent","full_name":"Samtidig Familj"}'),
  ('$T', 'hj-$T@example.invalid', '{"role":"tutor","full_name":"Samtidig Hjälpare"}');
update public.tutor_profiles set status = 'approved' where id = '$T';
insert into public.villkor_godkannanden (anvandare, version, kalla)
  values ('$F', intern.villkor_version(), 'registrering');
insert into public.students (id, parent_id, name, matched_tutor_id, match_status)
  values ('$S', '$F', 'Barn', '$T', 'matched');
insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                              timpris_ore, begart_ore, betalt_ore, status, giltigt_till, betald_at)
  values ('$K', '$F', 'klipp10', 'En timme', 'klippkort', 1, 6, 0, 39900, 39900, 39900, 'betald',
          current_date + 30, now());
insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
values ('$B1', '$F', '$T', '$S', '$F', current_date + 3, '15:00', 60, 'confirmed'),
       ('$B2', '$F', '$T', '$S', '$F', current_date + 4, '15:00', 60, 'confirmed');
SQL

fore=$($P -c "select kvar from public.klippkort_saldo where id = '$K'")
if [ "$fore" != "1" ]; then echo "FEL: timbanken har $fore timmar före provet, inte 1"; exit 1; fi

# ---------- två sessioner samtidigt ----------
$P > "$UT/a.txt" 2>&1 <<SQL &
begin;
select public.klippkort_dra('$B1', '$F')::text;
select pg_sleep(2);
commit;
SQL
sleep 0.5
start=$(date +%s.%N)
$P > "$UT/b.txt" 2>&1 <<SQL
begin;
select public.klippkort_dra('$B2', '$F')::text;
commit;
SQL
slut=$(date +%s.%N)
wait

a=$(grep -v '^$' "$UT/a.txt" | head -1)
b=$(grep -v '^$' "$UT/b.txt" | head -1)
vantade=$(awk "BEGIN { print ($slut - $start >= 1.0) ? \"ja\" : \"nej\" }")
efter=$($P -c "select kvar from public.klippkort_saldo where id = '$K'")
# kvar stannar på noll också när för många drogs (greatest i vyn): de använda räknas.
anvanda=$($P -c "select anvanda from public.klippkort_saldo where id = '$K'")
dragna=$($P -c "select count(*) from public.bookings where id in ('$B1', '$B2') and klippkort_id = '$K'")

fel=0
prov() { if [ "$2" = "ja" ]; then echo "ok   $1"; else echo "FEL  $1 ($3)"; fel=1; fi; }
prov "den första sessionen drar timmen" "$(echo "$a" | grep -q '"ok": true' && echo ja || echo nej)" "$a"
prov "den andra väntar på låset" "$vantade" "$(awk "BEGIN { print $slut - $start }") s"
prov "den andra säger nej: timmen är tagen" "$(echo "$b" | grep -q 'inga timmar kvar' && echo ja || echo nej)" "$b"
prov "bara ett pass har timmen" "$([ "$dragna" = "1" ] && echo ja || echo nej)" "$dragna pass"
prov "saldot blir noll, aldrig minus" "$([ "$efter" = "0" ] && echo ja || echo nej)" "kvar $efter"
prov "en timme är använd, inte två" "$([ "$anvanda" = "1" ] && echo ja || echo nej)" "använda $anvanda"
echo
[ $fel = 0 ] && echo "prova-samtidigt: 6 av 6 ok" || echo "prova-samtidigt: fel"
exit $fel
