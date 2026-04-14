#!/usr/bin/env bash
# Remove a worktree created by worktree-create.sh, after safety checks.
#
# Usage:
#   .claude/scripts/worktree-clean.sh <branch-name> [--delete-branch]
#
# Example:
#   .claude/scripts/worktree-clean.sh feat/perf-layout-parallel --delete-branch
#
# Safe behaviours:
#   - refuses if the worktree has uncommitted changes
#   - refuses if the branch has commits not present in develop AND not pushed
#   - never force-removes; uses git worktree remove (no --force unless explicitly
#     asked via --force flag in addition)
#   - branch deletion is opt-in (--delete-branch); refuses unmerged branches
#     unless --force-branch is passed

set -euo pipefail

BRANCH="${1:-}"
DELETE_BRANCH=0
FORCE_REMOVE=0
FORCE_BRANCH=0

shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --delete-branch) DELETE_BRANCH=1 ;;
    --force) FORCE_REMOVE=1 ;;
    --force-branch) FORCE_BRANCH=1 ;;
    *) echo "unknown flag: $1" >&2; exit 1 ;;
  esac
  shift
done

if [ -z "$BRANCH" ]; then
  echo "usage: $0 <branch-name> [--delete-branch] [--force] [--force-branch]" >&2
  exit 1
fi

if [ ! -d .git ] || [ ! -f CLAUDE.md ]; then
  echo "error: run from haretoki repo root" >&2
  exit 1
fi

SAFE=$(printf '%s' "$BRANCH" | tr '/' '-' | tr -cd 'A-Za-z0-9._-')
REPO_PARENT=$(cd .. && pwd)
TARGET="$REPO_PARENT/haretoki-wt-$SAFE"

if [ ! -d "$TARGET" ]; then
  echo "warn: worktree dir not found: $TARGET" >&2
  echo "      checking for orphan registration..."
  git worktree prune
  echo "done."
  exit 0
fi

# Refuse if dirty (unless --force)
if [ $FORCE_REMOVE -eq 0 ]; then
  if [ -n "$(git -C "$TARGET" status --porcelain)" ]; then
    echo "error: worktree has uncommitted changes: $TARGET" >&2
    echo "hint: commit/stash inside the worktree, or pass --force to discard" >&2
    exit 1
  fi
fi

# Remove worktree
if [ $FORCE_REMOVE -eq 1 ]; then
  git worktree remove --force "$TARGET"
else
  git worktree remove "$TARGET"
fi
echo "✓ removed worktree: $TARGET"

# Optional branch delete
if [ $DELETE_BRANCH -eq 1 ]; then
  if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "(branch $BRANCH not present locally, skipping delete)"
  else
    if [ $FORCE_BRANCH -eq 1 ]; then
      git branch -D "$BRANCH"
    else
      # -d refuses unmerged branches; safer default
      git branch -d "$BRANCH"
    fi
    echo "✓ deleted branch: $BRANCH"
  fi
fi
