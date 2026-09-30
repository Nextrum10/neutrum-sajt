#!/bin/bash
# ============================================================
# NEXTRUM — en lokal kopia av databasen, och rls-test.sql mot den
#
#   verktyg/lokal-databas.sh            bygg, och kör hela rls-test.sql
#   verktyg/lokal-databas.sh bygg       bara bygg
#   verktyg/lokal-databas.sh prova      kör rls-test.sql mot det som står
#   STOPP=<fil>.sql verktyg/lokal-databas.sh
#                                       bygg till och med den migrationen
#
# Förut gick sviten bara att köra mot driften, i en transaktion som
# rullades tillbaka (CLAUDE.md avsnitt 9). Det här bygger samma databas
# i Docker ur arkivet och alla migrationer, i den ordning
# supabase/migrations/arkiv/README.md anger, och kör sviten där. Första
# gången 2026-09-30: 923 av 923, samma antal som driften hade.
#
# Kräver Docker. Bilden är supabase/postgres (pg_cron, pg_net och
# rollerna finns i den); det den saknar av Auth och Storage står i
# verktyg/lokal-databas.sql. En ny container varje gång: bildens
# init-skript körs bara i databasen postgres, och pg_cron bor där.
# ============================================================
set -u
ROT="$(cd "$(dirname "$0")/.." && pwd)"
M="$ROT/supabase/migrations"
PORT="${PORT:-54329}"
BILD="${BILD:-supabase/postgres:15.8.1.085}"
NAMN="${NAMN:-nextrum-lokal}"
UT="${TMPDIR:-/tmp}/nextrum-lokal"
mkdir -p "$UT"
export PGPASSWORD=postgres
P="psql -h localhost -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"

bygg() {
  docker rm -f "$NAMN" > /dev/null 2>&1
  docker run -d --name "$NAMN" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$BILD" > /dev/null || exit 1
  for _ in $(seq 1 90); do
    sleep 1
    docker logs "$NAMN" 2>&1 | grep -q "pg_cron scheduler started" \
      && psql -h localhost -p "$PORT" -U postgres -d postgres -Atc "select 1" > /dev/null 2>&1 && break
  done
  sleep 2
  psql -h localhost -p "$PORT" -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q \
    -f "$ROT/verktyg/lokal-databas.sql" || exit 1
  # schema-v22.sql kördes aldrig i driften, och står därför inte här.
  for f in schema.sql schema-v2.sql schema-v3.sql schema-v4.sql schema-v5.sql schema-v6.sql schema-v7.sql \
           schema-v8.sql schema-v9.sql schema-v10.sql schema-v11.sql schema-v12.sql schema-v13-agenter.sql \
           schema-v13.sql schema-v14.sql schema-v16-rapportomdome.sql schema-v15.sql schema-v17-sokvag.sql \
           schema-v18.sql schema-v16.sql schema-v17.sql schema-v19.sql schema-v20.sql schema-v21.sql \
           schema-v23.sql schema-v24.sql schema-v25.sql; do
    $P -f "$M/arkiv/$f" > "$UT/bygg.log" 2>&1 || { echo "FEL i arkiv/$f"; grep -m3 -A3 ERROR "$UT/bygg.log"; exit 1; }
  done
  for f in $(ls "$M"/*.sql | sort); do
    if [ -n "${STOPP:-}" ] && [[ "$(basename "$f")" > "$STOPP" ]]; then break; fi
    $P -1 -f "$f" > "$UT/bygg.log" 2>&1 || { echo "FEL i $(basename "$f")"; grep -m3 -A3 ERROR "$UT/bygg.log"; exit 1; }
  done
  echo "byggd: $(ls "$M"/*.sql | wc -l) migrationer${STOPP:+, till och med $STOPP}"
}

prova() {
  psql -h localhost -p "$PORT" -U postgres -d postgres -X -A -F $'\t' -t \
    -f "$ROT/verktyg/rls-test.sql" > "$UT/prov.txt" 2> "$UT/prov.err"
  local rader ok
  rader=$(grep -c $'\t' "$UT/prov.txt")
  ok=$(grep -c $'\tt\t' "$UT/prov.txt")
  echo "rls-test.sql: $ok av $rader ok"
  grep $'\tf\t' "$UT/prov.txt"
  grep -m5 ERROR "$UT/prov.err"
  [ "$ok" = "$rader" ] && [ "$rader" -gt 0 ]
}

case "${1:-}" in
  bygg) bygg ;;
  prova) prova ;;
  *) bygg && prova ;;
esac
