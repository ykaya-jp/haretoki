# MCP Operations — Haretoki

Model Context Protocol (MCP) servers extend Claude Code with structured tool access — search Refero for UI references, query Vercel deployment state, fetch live library docs from Context7, edit Figma designs, etc. This document defines **which server to use when**, **how to add new ones**, and **how secrets are handled** in this repo.

> Source-of-truth files
> - Project MCP config: `.claude/.mcp.json` (gitignored, copy from `.mcp.json.example`)
> - Plugin-provided MCP: configured via `enabledPlugins` in user / project settings
> - This document: linked from `.claude/README.md` and `docs/harness/runbook.md`

---

## 1. Two kinds of MCP — don't mix them up

| Origin | Where it lives | Examples we use | How to enable |
|---|---|---|---|
| **Plugin-provided** | Marketplace plugins under `~/.claude/plugins/` or `.claude/.mcp.json` indirectly | Refero, Context7, Vercel, Figma | Already enabled — they show up via `enabledPlugins` in the global Claude Code config; tools appear with the `mcp__plugin_<plugin>_<server>__<tool>` prefix. |
| **Project-defined** | `.claude/.mcp.json` (gitignored) | github, supabase, postgres-ro, filesystem-readonly, sentry — see `.mcp.json.example` | Copy `.mcp.json.example` → `.mcp.json`, fill `${ENV_VAR}`s, flip `disabled: false` on the servers you want, restart Claude Code. |

**CRITICAL — never re-declare a plugin server in `.mcp.json`.** The two layers merge by key, and the plugin config wins for plugin-provided servers. Adding e.g. `vercel` to `.mcp.json` will at best be ignored, at worst will conflict. The starter file in this repo lists only project-only candidates.

---

## 2. When to reach for which server

Use this as the first decision tree before any new tool call. The goal is to spend Claude's context on signal, not on noise from a wrong-fit server.

| Situation | Use | Don't use |
|---|---|---|
| "How does Next.js 16 do X?" / library API question | **Context7** (`mcp__plugin_context7_context7__query-docs`) — it grabs live docs | Web search (slower, less authoritative for library API questions) |
| Building a new screen / flow / component | **Refero** (`mcp__refero__refero_search_screens`, `..._get_screen`) — research 5–10 reference screens before writing TSX | Designing from memory — prevents generic AI-slop UI |
| Deploy status / build logs / promote a preview | **Vercel** (`mcp__plugin_vercel_vercel__get_deployment`, `..._list_deployments`, `..._get_runtime_logs`) | Reading the Vercel UI manually — slower and pulls you out of the IDE flow |
| Touching a Figma file the user pasted | **Figma** (`mcp__claude_ai_Figma__get_design_context`, `..._get_screenshot`) | Asking the user to describe the design — they pasted a URL for a reason |
| Production runtime errors / Sentry triage | **sentry** (project MCP, disabled by default) | `console.log` rabbit-holes |
| Schema audit / SQL EXPLAIN / N+1 hunt | **postgres-ro** (project MCP) → falls through to **supabase** if you also need to apply a migration | Editing `prisma/schema.prisma` blind — read live state first |
| GitHub PR / issue / cross-repo search | **github** (project MCP) | `gh` CLI when the goal is *reasoning over* PR content rather than scripting it |
| Reading research notes / scraped data outside the repo | **filesystem-readonly** (project MCP, scoped roots) | Copying private files into the repo |

---

## 3. Plugin MCP usage rules (Refero / Context7 / Vercel / Figma)

These are always-on for the team. Each has an idiomatic call shape — getting it wrong wastes context.

### Refero — Research-First UI

`mcp__refero__refero_search_screens` → `mcp__refero__refero_get_screen` (with `include_similar: true`) → `mcp__refero__refero_get_design_guidance`.

- Skip Refero only when the user explicitly says "no research, just build it." Phase 1 + Phase 2 design memory both flag generic-looking UIs that skipped the research step.
- 5–10 reference screens is the working budget. Past 10, you're stalling.
- Always extract patterns into the brand context (晴れ時: 曇り → 晴れ間 → 晴れの日) before drafting components — straight transplants ignore the brand metaphor and read as borrowed.

### Context7 — Library docs

- Trigger conditions: any time a Next.js / Prisma / Supabase / Tailwind / shadcn / framer-motion / `@tanstack/*` / `next/og` API is being used. Even when you "remember" the API.
- Call shape: pass a *specific* question, not a topic. Bad: "Next.js metadata". Good: "Next.js 16 App Router opengraph-image.tsx ImageResponse with custom font readFile".
- Library ID: prefer the canonical `/<org>/<project>` form. If unsure, call `resolve-library-id` first — but cap at 3 resolve calls per question.
- Output → adapt to the project. Context7 returns library-default examples; rewrite them against `src/app/...` paths and existing project conventions before pasting.

### Vercel — Deployment state

Default reaches:
- `get_deployment` — single deployment status, build / runtime / build_logs
- `list_deployments` — recent activity
- `get_runtime_logs` — production / preview live logs
- `web_fetch_vercel_url` — fetch the response of a specific deployment URL bypassing local DNS

Don't use Vercel MCP for:
- Promoting deployments (use `vercel promote <id>` via the `vercel:deploy` skill — promotes are state-changing and benefit from the explicit shell trail)
- Setting env vars (use `vercel env`; the audit log matters)

### Figma — Design context

When the user shares a `figma.com/design/...` URL:
1. Parse `fileKey` and `nodeId` from the URL (replace `-` with `:` in nodeId).
2. Call `get_design_context` with both. The response is React+Tailwind-shaped — treat it as **reference**, not paste-target. Adapt to project tokens (oklch / `--gold-warm` / `--background`).
3. If `get_design_context` returns Code Connect mappings, use the mapped component verbatim — that's the team's intent.
4. For visual context only, `get_screenshot` is enough; skip `get_design_context` to save context.

---

## 4. Adding a new project MCP server

1. Edit `.claude/.mcp.json.example` first (the canonical reference, committed). Add the server entry with:
   - A `$comment` describing **when** to use it, **why** the tool is preferred over alternatives, and any rate / cost / safety caveats.
   - Every secret as `${ENV_VAR}` — the value lives in the user's `~/.claude/.env` or shell, never inline.
   - `disabled: true` by default, so cloning the repo doesn't auto-launch new processes.
2. Update this file's "When to reach for which server" table.
3. Update `.claude/README.md` if the new server changes the harness summary.
4. Open a PR — do not commit `.mcp.json` itself (gitignored, would contain real env values for the author's machine).
5. After merge, each developer copies `.mcp.json.example` → `.mcp.json`, sets their env vars, and flips `disabled: false` for the servers they want.

---

## 5. Secret management

| Source | Enforcement |
|---|---|
| `.claude/.mcp.json` (real config) | Gitignored. `.gitignore` already has the entry — verify before committing schema changes that touch the file. |
| `.env` / `.env.local` / `*credentials*` / `*.key` / `*.pem` | Blocked at write-time by the `PreToolUse` hook in `.claude/settings.json`. The hook returns exit 2 + an explicit refusal message — Claude cannot bypass it without the user manually editing the file. |
| Per-MCP env var values | Read from the developer's shell / `~/.claude/.env`. Never echoed back into the conversation. |
| Audit trail | All MCP tool calls are logged through Claude Code's standard tool-call telemetry. `vercel env *` writes are additionally captured by Vercel's own audit log. |

If a server requires a key with write scope (e.g. `supabase` SERVICE_ROLE), prefer:
1. Using the **read-only** project MCP (`postgres-ro`) for inspection.
2. Falling back to a temporary, scoped key when a write is genuinely needed.
3. Rotating the key after the session.

---

## 6. Known caveats

- **Restart required after editing `.mcp.json`.** Claude Code reads it once at session start. `/mcp` confirms the active server list.
- **Plugin MCP can't be disabled per-project from `.mcp.json`.** If the team wants Refero off for one repo, do it via `enabledPlugins` in the project's `settings.json`.
- **Tool name length.** MCP tool names compose as `mcp__<source>__<tool>`. The longest names (e.g. `mcp__plugin_vercel_vercel__get_deployment_build_logs`) eat ~50 characters per call — minor but worth knowing when you're tight on context.

---

## 7. Phase 3 follow-ups (deferred)

- ADR for the choice of MCP servers (`docs/harness/adr/0001-mcp-servers.md`).
- Custom MCP server for Haretoki venue scraping (currently an ad-hoc `scripts/` Python flow; promoting to MCP would let any agent invoke it consistently).
- `docs-curator` subagent (Phase 3 in `.claude/README.md`) wired to MCP for cross-PR docs drift detection.
