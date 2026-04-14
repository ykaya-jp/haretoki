#!/usr/bin/env bash
# Create an isolated git worktree for parallel implementation.
#
# Usage:
#   .claude/scripts/worktree-create.sh <branch-name> [base-branch]
#
# Example:
#   .claude/scripts/worktree-create.sh feat/perf-layout-parallel develop
#
# Creates: ../haretoki-wt-<sanitized-branch>/
#   from base-branch (default: develop)
#   on a new branch <branch-name>
#
# Safe behaviours:
#   - refuses if the target dir exists
#   - refuses if the branch already exists locally
#   - refuses on dirty working tree (uncommitted changes)
#   - refuses if not in the haretoki repo root

set -euo pipefail

BRANCH="${1:-}"
BASE="${2:-develop}"

if [ -z "$BRANCH" ]; then
  echo "usage: $0 <branch-name> [base-branch=develop]" >&2
  exit 1
fi

# Must be run from repo root
if [ ! -d .git ] || [ ! -f CLAUDE.md ]; then
  echo "error: run from haretoki repo root" >&2
  exit 1
fi

# Sanitize branch name for directory: feat/foo → feat-foo
SAFE=$(printf '%s' "$BRANCH" | tr '/' '-' | tr -cd 'A-Za-z0-9._-')
if [ -z "$SAFE" ]; then
  echo "error: branch name produced empty sanitized form" >&2
  exit 1
fi

REPO_PARENT=$(cd .. && pwd)
TARGET="$REPO_PARENT/haretoki-wt-$SAFE"

if [ -e "$TARGET" ]; then
  echo "error: target path already exists: $TARGET" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "error: branch already exists locally: $BRANCH" >&2
  echo "hint: pick a new branch name, or remove the old branch first" >&2
  exit 1
fi

# Refuse dirty tree (avoid surprising the user)
if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree has uncommitted changes; commit or stash first" >&2
  exit 1
fi

# Make sure base branch is up-to-date locally (best effort, non-fatal)
git fetch origin "$BASE" >/dev/null 2>&1 || true

git worktree add -b "$BRANCH" "$TARGET" "$BASE"

# Convenience: copy .env.local into the worktree if present (gitignored, but
# the worktree won't have a working .env without it). User can override.
if [ -f .env.local ] && [ ! -f "$TARGET/.env.local" ]; then
  cp .env.local "$TARGET/.env.local"
  echo "→ copied .env.local into worktree"
fi

echo
echo "✓ worktree ready"
echo "  branch:  $BRANCH"
echo "  base:    $BASE"
echo "  path:    $TARGET"
echo
echo "next:"
echo "  cd $TARGET"
echo "  npm install   # only if node_modules differs"
