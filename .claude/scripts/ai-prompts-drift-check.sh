#!/bin/bash
#
# .claude/scripts/ai-prompts-drift-check.sh
#
# PostToolUse hook — warns when the AI prompt source (`src/lib/prompts/*.ts`
# or `src/lib/anthropic.ts`) is edited without the paired human-readable
# spec under `docs/ai/**/*.md` being touched in the same working tree.
#
# Why a warning, not a block:
#   - A typo fix or rename refactor doesn't need a doc update.
#   - The dev may be about to edit the md file next; warning early lets
#     them know the contract before the next tool call.
#   - PostToolUse `exit 2` would refuse the user's edit, which feels
#     adversarial for a soft-rule like "remember to update the doc".
#
# Pairing source of truth:
#   - For prompts: each `docs/ai/prompts/*.system.md` carries a YAML
#     `pairs_with: src/lib/prompts/<name>.ts` frontmatter. We grep
#     for that line so the mapping doesn't have to be re-implemented
#     here (single source of truth = the md frontmatter).
#   - For `src/lib/anthropic.ts`: hard-coded pairing with
#     `docs/ai/guardrails.md` (the only relevant doc today; future
#     `streaming.md` etc. can be added to the array).
#
# Hook contract:
#   - Reads `CLAUDE_FILE_PATH` (absolute path of the edited file)
#   - Reads `CLAUDE_PROJECT_DIR` (project root, falls back to git root)
#   - Always exits 0 (warning only) — output to STDERR per Claude Code
#     hook conventions.

set -uo pipefail

f="${CLAUDE_FILE_PATH:-}"
[ -z "$f" ] && exit 0

# Cheap short-circuit: most edits don't touch AI surface, so check the
# path early and return without spawning git.
case "$f" in
  */src/lib/prompts/*.ts | */src/lib/anthropic.ts) ;;
  *) exit 0 ;;
esac

# Project root. Claude Code passes CLAUDE_PROJECT_DIR for us; fall back
# to git so the script also works when invoked manually for testing.
ROOT="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$ROOT" ]; then
  ROOT=$(git -C "$(dirname "$f")" rev-parse --show-toplevel 2>/dev/null || true)
fi
[ -z "$ROOT" ] && exit 0

# Relative path from the project root — git status uses these.
rel="${f#"$ROOT"/}"

# Determine paired md(s). Initialise empty so the `${#paired_mds[@]}` check
# below stays safe under `set -u` even when the case branch ends up adding
# nothing (e.g. brand-new prompts/*.ts with no documented pair yet).
paired_mds=()
case "$rel" in
  src/lib/anthropic.ts)
    # Library-level changes (PII / sanitization / retry / streaming) hit
    # the contract that guardrails.md documents. Future doc surfaces can
    # be appended here without changing the hook wiring.
    paired_mds=("docs/ai/guardrails.md")
    ;;
  src/lib/prompts/*.ts)
    base="${rel#src/lib/prompts/}"
    base="${base%.ts}"
    # Locate every md whose frontmatter declares this ts file as its pair.
    # `grep -l` for the exact `pairs_with: ...` line keeps the mapping
    # owned by the md frontmatter (no parallel registry to drift from).
    while IFS= read -r md; do
      [ -n "$md" ] && paired_mds+=("${md#"$ROOT"/}")
    done < <(
      grep -l "^pairs_with: src/lib/prompts/${base}\.ts\$" \
        "$ROOT"/docs/ai/prompts/*.system.md 2>/dev/null || true
    )
    ;;
esac

# Soft warn when no pair is registered — e.g. a brand-new prompt file
# that nobody documented yet. Don't block; surface the gap.
if [ "${#paired_mds[@]}" -eq 0 ]; then
  echo "[ai-prompts-drift] WARN: edited '$rel' but no paired docs/ai/**/*.md found." >&2
  echo "  Either add a docs/ai/prompts/<name>.system.md with frontmatter 'pairs_with: $rel'," >&2
  echo "  or extend .claude/scripts/ai-prompts-drift-check.sh if this file should pair elsewhere." >&2
  exit 0
fi

# Check whether each paired md is dirty in the working tree.
# `git status --porcelain` returns a non-empty line for staged or
# unstaged changes — empty output means the file is in sync with HEAD.
unsynced=()
for md in "${paired_mds[@]}"; do
  status=$(git -C "$ROOT" status --porcelain -- "$md" 2>/dev/null || true)
  if [ -z "$status" ]; then
    unsynced+=("$md")
  fi
done

if [ "${#unsynced[@]}" -gt 0 ]; then
  echo "[ai-prompts-drift] WARN: '$rel' was edited but the paired doc(s) below are NOT modified in the working tree:" >&2
  for md in "${unsynced[@]}"; do
    echo "  - $md" >&2
  done
  echo "Update both in the same PR (Haretoki convention: prompts/* と docs/ai/prompts/*.system.md は同 PR で同期)." >&2
fi

exit 0
