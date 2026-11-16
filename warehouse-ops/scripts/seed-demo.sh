#!/usr/bin/env bash
# Loads synthetic demo data into a database (local Supabase by default).
#   DEMO_PASSWORD='choose-a-long-password' bash scripts/seed-demo.sh [postgres-connection-url]
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DEMO_PASSWORD:?Set DEMO_PASSWORD (12+ characters) first}"
URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
if [[ ${#DEMO_PASSWORD} -lt 12 || "$DEMO_PASSWORD" == *"'"* ]]; then echo "DEMO_PASSWORD must be 12+ characters with no quotes" >&2; exit 1; fi
sed "s|__DEMO_PASSWORD__|${DEMO_PASSWORD//|/\\|}|" supabase/demo/synthetic-demo-data.sql | psql "$URL" -X -q -v ON_ERROR_STOP=1
