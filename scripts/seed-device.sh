#!/usr/bin/env bash
#
# Restores the seeded WatermelonDB snapshot onto a connected device, replacing
# whatever collection is currently on it. Saves walking the CSV import through
# the UI every time a device is wiped.
#
#   ./scripts/seed-device.sh                      # default device, fresh timestamps
#   ./scripts/seed-device.sh -s emulator-5554     # pick a device
#   ./scripts/seed-device.sh --keep-timestamps    # leave created_at as captured
#   ./scripts/seed-device.sh path/to/other.db     # restore a different snapshot
#
# Only works on a DEBUG build: pushing into the app sandbox needs `run-as`,
# which the OS refuses for a non-debuggable (release) package.
set -euo pipefail

PKG=com.anonymous.AptitudeWords
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_SRC="$REPO_ROOT/test-data/vocab-hub-seed.db"
KEEP_TIMESTAMPS=0
ADB_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s) ADB_ARGS+=(-s "$2"); shift 2 ;;
    --keep-timestamps) KEEP_TIMESTAMPS=1; shift ;;
    -h|--help) sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) DB_SRC="$1"; shift ;;
  esac
done

adb_() { adb "${ADB_ARGS[@]}" "$@"; }

[[ -f "$DB_SRC" ]] || { echo "error: snapshot not found: $DB_SRC" >&2; exit 1; }

# `run-as` is the whole mechanism here — fail loudly rather than half-seeding.
if ! adb_ shell "run-as $PKG true" 2>/dev/null; then
  echo "error: cannot run-as $PKG — install the DEBUG build first:" >&2
  echo "  adb install -r android/app/build/outputs/apk/debug/app-debug.apk" >&2
  exit 1
fi

STAGED="$(mktemp -t vocabhub-seed).db"
trap 'rm -f "$STAGED"' EXIT
cp "$DB_SRC" "$STAGED"

if [[ $KEEP_TIMESTAMPS -eq 0 ]]; then
  # Day completion is derived from created_at, so a snapshot restored weeks
  # later would read as "0 words today, streak 0". Shift the whole set forward
  # by a constant so the newest word lands ~now and relative order survives.
  sqlite3 "$STAGED" "
    UPDATE words
       SET created_at = created_at
                      + (CAST(strftime('%s','now') AS REAL) * 1000
                         - (SELECT MAX(created_at) FROM words));"
fi

WORDS=$(sqlite3 "$STAGED" "SELECT COUNT(*) FROM words;")

adb_ shell am force-stop "$PKG"
adb_ push "$STAGED" /data/local/tmp/watermelon.db >/dev/null
# WAL/SHM from the old database would otherwise replay over the restored file.
adb_ shell "run-as $PKG sh -c 'cp /data/local/tmp/watermelon.db watermelon.db \
  && rm -f watermelon.db-wal watermelon.db-shm'"
adb_ shell rm -f /data/local/tmp/watermelon.db
adb_ shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1

echo "Seeded $WORDS words onto $(adb_ get-serialno). All arcade games unlocked."
