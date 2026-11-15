#!/usr/bin/env bash
# Runs the database security tests against a real PostgreSQL server.
#
#   npm run test:db
#
# By default this starts a throwaway local PostgreSQL 16 cluster, loads a minimal
# Supabase stand-in (auth + storage), applies every migration in supabase/migrations,
# then runs each supabase/tests/*.sql file. Any failed assertion stops with an error.
#
# To use an existing empty database instead (e.g. in CI), set DATABASE_URL to a
# superuser connection string.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

cleanup() { :; }
trap 'cleanup' EXIT

if [[ -z "${DATABASE_URL:-}" ]]; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -z "$PGBIN" ]] && command -v pg_ctl >/dev/null; then PGBIN="$(dirname "$(command -v pg_ctl)")"; fi
  if [[ -z "$PGBIN" ]]; then
    echo "PostgreSQL server binaries not found. Install PostgreSQL 15+ or set DATABASE_URL." >&2
    exit 1
  fi
  WORK="$(mktemp -d)"
  PORT="${DB_TEST_PORT:-54329}"
  RUN=()
  if [[ "$(id -u)" == "0" ]]; then
    # PostgreSQL refuses to run as root; use the postgres system user.
    chown postgres "$WORK"
    RUN=(runuser -u postgres --)
  fi
  "${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
  cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
  DATABASE_URL="postgresql://postgres@/postgres?host=$WORK&port=$PORT"
fi

PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 --set=SHOW_CONTEXT=never)

echo "→ Loading Supabase stand-in"
"${PSQL[@]}" -f "$ROOT/scripts/db/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ Applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f "$ROOT/scripts/db/test-helpers.sql"

status=0
ALL_OK=""
for t in "$ROOT"/supabase/tests/*.sql; do
  echo "→ Running $(basename "$t")"
  if ! out="$("${PSQL[@]}" -o /dev/null -f "$t" 2>&1)"; then
    echo "$out" | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR):  /  \1 /'
    status=1
  else
    ALL_OK+="$(grep -E "ok - " <<<"$out" || true)"$'\n'
    echo "$out" | sed -E 's/^psql:[^ ]+ NOTICE:  /  /'
  fi
done

if [[ $status -ne 0 ]]; then
  echo "✗ Database security tests FAILED" >&2
  exit 1
fi
echo "✓ All $(grep -c "ok - " <<<"$ALL_OK") database security checks passed"
