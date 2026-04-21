#!/usr/bin/env bash
# verify.sh — one-shot pre-commit / pre-ship quality gate.
# Mirrors the checks ~/.claude/CLAUDE.md calls out as mandatory before
# declaring work "done": lint, tsc, vitest, next build.
#
# Usage:
#   scripts/verify.sh            # full chain
#   scripts/verify.sh --fast     # lint + tsc + tests, skip build
#   scripts/verify.sh --build    # build only
#
# Exits non-zero on the first failing step so CI / agents can bail
# early. Prints a colour-coded summary at the end regardless.

set -e
set -o pipefail
cd "$(dirname "$0")/.."

MODE="${1:-full}"

BOLD=$'\e[1m'
RED=$'\e[31m'
GREEN=$'\e[32m'
YELLOW=$'\e[33m'
RESET=$'\e[0m'

step() {
  printf "\n%s→ %s%s\n" "$BOLD" "$1" "$RESET"
}

ok() {
  printf "%s✓ %s%s\n" "$GREEN" "$1" "$RESET"
}

fail() {
  printf "%s✗ %s%s\n" "$RED" "$1" "$RESET"
  exit 1
}

if [[ "$MODE" != "--build" ]]; then
  step "lint"
  npm run lint || fail "lint failed"
  ok "lint passed"

  step "typecheck"
  npx tsc --noEmit || fail "tsc failed"
  ok "tsc passed"

  step "unit tests"
  npm test -- --run --reporter=default 2>&1 | tail -20
  # npm test exits 0 only when all tests pass — set -e takes care of it.
  ok "tests passed"
fi

if [[ "$MODE" == "--fast" ]]; then
  printf "\n%s━━━━━━━━━━━━━━━━━━━━━━━━━%s\n" "$YELLOW" "$RESET"
  ok "fast verify complete (build skipped)"
  exit 0
fi

step "production build"
npm run build > /tmp/haretoki-build.log 2>&1 || {
  printf "%slast 30 lines of build log:%s\n" "$RED" "$RESET"
  tail -30 /tmp/haretoki-build.log
  fail "build failed (full log in /tmp/haretoki-build.log)"
}
ok "build passed"

printf "\n%s━━━━━━━━━━━━━━━━━━━━━━━━━%s\n" "$GREEN" "$RESET"
ok "verify complete"
