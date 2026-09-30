#!/usr/bin/env bash
#
# Re-captures the Phase 5 parity fixtures from a running CLESS-Server.
#
# The fixtures next to this script are real server output, not hand-written
# samples, which is the point: `tests/live-parity.spec.ts` compares the
# player's XML adapter against the server's JSON converter on the same input,
# and a hand-written fixture would only prove the two agree with whatever the
# author assumed.
#
# On the server, with a database that has been seeded:
#
#   python manage.py seed_validation_data --reset
#   python manage.py runserver 127.0.0.1:8099
#
# Then here:
#
#   ./refresh.sh [base-url]
#
# The display, layout and playlist ids below are the ones seed_validation_data
# creates. Commit whatever changes, and expect `revision`/`etag`/`generatedAt`
# to move on every capture -- the parity harness normalises those away.
set -euo pipefail

BASE="${1:-http://127.0.0.1:8099/demo}"
cd "$(dirname "$0")"

fetch() {
  local path="$1" out="$2"
  local code
  code="$(curl -sS -o "$out" -w '%{http_code}' "$BASE/$path")"
  if [ "$code" != "200" ]; then
    echo "FAIL $path -> HTTP $code" >&2
    exit 1
  fi
  printf '  %-16s %7d bytes  %s\n' "$out" "$(wc -c <"$out")" "$path"
}

echo "Capturing from $BASE"
fetch "1/ds.xml" playlist.xml
fetch "1/ds.json" playlist.json
fetch "layout/1/ds.xml" layout-1.xml
fetch "layout/1/ds.json" layout-1.json
fetch "layout/2/ds.xml" layout-2.xml
fetch "layout/2/ds.json" layout-2.json

# An HTML body here means the request was answered by the demo-licence guard or
# an error page rather than the layout views, and the parity run would fail with
# an unhelpful parse error instead.
if grep -lq "<html" ./*.xml ./*.json 2>/dev/null; then
  echo "FAIL a capture contains HTML; check the server log and activation state" >&2
  exit 1
fi

echo "Done. Run: npm --prefix ../../.. run test:renderer"
