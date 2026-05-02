#!/usr/bin/env bash
# scripts/check-migration-safety.sh
#
# Phase 4 destructive-migration guard. Greps the most recent
# prisma/migrations/*/migration.sql for SQL keywords that drop /
# truncate / unconditionally delete rows, and refuses to proceed
# unless the developer explicitly opts in via:
#
#   ALLOW_DESTRUCTIVE_MIGRATION=1 npm run migrate:check
#
# Why a script instead of pure-CI: prisma migrate runs locally first
# (`npx prisma migrate dev --name X`) and immediately writes the SQL
# to disk + applies to dev DB. By the time CI catches a destructive
# migration, the developer has already lived with broken local data.
# This script runs as a `prepare:migrate` hook so the destructive
# preview is caught BEFORE the developer types `npx prisma migrate`.
#
# Why bash instead of TS: the runtime needs to be available even
# when prisma client isn't generated yet (= post-clone, pre-install).
#
# Exit codes:
#   0 — migration looks safe (no destructive keywords) OR override is set
#   1 — usage error
#   2 — destructive keyword found (= block)
#
# Detection rules — ordered most-to-least dangerous. False-positive
# tolerance is intentional: the operator types ALLOW_DESTRUCTIVE_=1
# once and proceeds, vs missing a real DROP and losing data:
#
#   - DROP TABLE ...
#   - DROP COLUMN / DROP CONSTRAINT
#   - ALTER TABLE ... DROP ...
#   - TRUNCATE TABLE / TRUNCATE
#   - DELETE FROM ... (without WHERE — i.e. unconditional)
#   - DROP INDEX (= rebuild cost may stall prod, treat as destructive)
#   - DROP SCHEMA
#
# Patterns ignored on purpose (false-positive avoidance):
#   - `DROP TABLE IF EXISTS` inside a CREATE TABLE comment header (we
#     only match top-level statements, not comments)
#   - `DELETE FROM ... WHERE ...` (= bounded delete, fine)

set -euo pipefail

readonly MIGRATIONS_DIR="${MIGRATIONS_DIR:-prisma/migrations}"
readonly OVERRIDE_VAR="ALLOW_DESTRUCTIVE_MIGRATION"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "[migration-safety] migrations dir not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

# Find the most recent migration.sql (lexicographically last directory
# matching the YYYYMMDDHHMMSS_name shape). `ls -1` keeps it portable to
# macOS bash without needing GNU find features.
LATEST_DIR="$(ls -1 "$MIGRATIONS_DIR" | grep -E '^[0-9]{14}_' | sort | tail -n 1 || true)"
if [ -z "${LATEST_DIR:-}" ]; then
  echo "[migration-safety] no timestamped migration found in $MIGRATIONS_DIR" >&2
  exit 1
fi

readonly LATEST_SQL="$MIGRATIONS_DIR/$LATEST_DIR/migration.sql"
if [ ! -f "$LATEST_SQL" ]; then
  echo "[migration-safety] missing $LATEST_SQL" >&2
  exit 1
fi

echo "[migration-safety] checking $LATEST_SQL" >&2

# Strip line comments (-- to EOL) so a "-- safe to DROP this column later"
# comment doesn't trigger. Block comments (/* ... */) are rare in our
# generated migrations; if they ever appear, the script's worst-case is
# a false-positive that the override flag dismisses.
STRIPPED="$(sed -e 's|--.*$||' "$LATEST_SQL")"

# Patterns to flag. Word boundaries (\b) prevent matching e.g. "DROPDOWN".
# Case-insensitive so DROP / drop / Drop all hit.
DESTRUCTIVE_PATTERNS=(
  '\bDROP[[:space:]]+TABLE\b'
  '\bDROP[[:space:]]+COLUMN\b'
  '\bDROP[[:space:]]+CONSTRAINT\b'
  '\bDROP[[:space:]]+INDEX\b'
  '\bDROP[[:space:]]+SCHEMA\b'
  '\bTRUNCATE\b'
)

FOUND=0
declare -a HITS=()

for pat in "${DESTRUCTIVE_PATTERNS[@]}"; do
  while IFS= read -r line; do
    HITS+=("  - matched '$pat': $(echo "$line" | tr -s '[:space:]')")
    FOUND=1
  done < <(echo "$STRIPPED" | grep -Ein "$pat" || true)
done

# Special case: DELETE FROM ... must have a WHERE within the same statement
# (semicolon terminator). Scan statement-by-statement.
while IFS= read -r stmt; do
  trimmed="$(echo "$stmt" | tr -s '[:space:]' | sed -e 's/^ //' -e 's/ $//')"
  if echo "$trimmed" | grep -Eiq '^DELETE[[:space:]]+FROM\b'; then
    if ! echo "$trimmed" | grep -Eiq '\bWHERE\b'; then
      HITS+=("  - matched 'unconditional DELETE FROM' (no WHERE): $trimmed")
      FOUND=1
    fi
  fi
done < <(echo "$STRIPPED" | tr ';' '\n')

if [ "$FOUND" -eq 0 ]; then
  echo "[migration-safety] OK — no destructive patterns found" >&2
  exit 0
fi

echo "" >&2
echo "[migration-safety] BLOCKED — destructive patterns found:" >&2
for hit in "${HITS[@]}"; do
  echo "$hit" >&2
done
echo "" >&2

if [ "${!OVERRIDE_VAR:-}" = "1" ]; then
  echo "[migration-safety] $OVERRIDE_VAR=1 set — proceeding under operator opt-in." >&2
  echo "[migration-safety] WARNING: review the migration carefully + take a backup before applying." >&2
  echo "[migration-safety] See docs/harness/backup-restore-plan.md for the manual pg_dump escape hatch." >&2
  exit 0
fi

echo "[migration-safety] To proceed (after backup + review):" >&2
echo "    $OVERRIDE_VAR=1 npm run migrate:check" >&2
exit 2
