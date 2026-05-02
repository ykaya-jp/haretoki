import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Behavioural test for scripts/check-migration-safety.sh — Phase 4
 * destructive-migration guard. Spins up a temp migrations dir,
 * writes fake migrations into it, and asserts the script's exit
 * code + stderr output matches the contract.
 *
 * Why bash + vitest: the script itself is shell so the Claude Code
 * PreToolUse hook can run without a Node runtime. Vitest just
 * spawns the script with MIGRATIONS_DIR pointing at the temp dir
 * — tests stay fast (no DB / no fixtures to load).
 *
 * `spawnSync` (not `execFileSync`) so stderr is captured on BOTH
 * success and failure paths — `execFileSync` only exposes stderr
 * via the thrown error, which makes the success-path assertions
 * blind to the script's "OK — no destructive patterns found" line.
 */

const SCRIPT_PATH = join(process.cwd(), "scripts", "check-migration-safety.sh");

function runScript(opts: {
  migrationsDir: string;
  allowDestructive?: boolean;
}): { exitCode: number; stderr: string } {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MIGRATIONS_DIR: opts.migrationsDir,
  };
  if (opts.allowDestructive) {
    env.ALLOW_DESTRUCTIVE_MIGRATION = "1";
  } else {
    delete env.ALLOW_DESTRUCTIVE_MIGRATION;
  }
  const result = spawnSync("bash", [SCRIPT_PATH], {
    env,
    encoding: "utf-8",
  });
  return {
    exitCode: result.status ?? -1,
    stderr: result.stderr ?? "",
  };
}

function makeMigrationsDir(): string {
  return mkdtempSync(join(tmpdir(), "haretoki-migration-test-"));
}

function writeMigration(dir: string, name: string, sql: string): void {
  const subDir = join(dir, name);
  mkdirSync(subDir, { recursive: true });
  writeFileSync(join(subDir, "migration.sql"), sql);
}

describe("check-migration-safety.sh — additive migrations pass", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeMigrationsDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("exits 0 for a CREATE TABLE migration", () => {
    writeMigration(
      dir,
      "20260101120000_add_thing",
      `CREATE TABLE "things" ("id" UUID PRIMARY KEY);`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toMatch(/no destructive patterns found/);
  });

  it("exits 0 for ALTER TABLE ADD COLUMN (additive)", () => {
    writeMigration(
      dir,
      "20260101120000_add_col",
      `ALTER TABLE "things" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(0);
  });

  it("exits 0 for CREATE INDEX", () => {
    writeMigration(
      dir,
      "20260101120000_add_index",
      `CREATE INDEX "things_name_idx" ON "things" ("name");`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(0);
  });

  it("exits 0 for DELETE WITH WHERE (= bounded delete)", () => {
    writeMigration(
      dir,
      "20260101120000_cleanup",
      `DELETE FROM "things" WHERE "id" = '00000000-0000-0000-0000-000000000000';`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(0);
  });

  it("ignores destructive keywords inside SQL comments (= header / doc)", () => {
    writeMigration(
      dir,
      "20260101120000_with_comment",
      `-- This migration prepares us to DROP COLUMN later
CREATE TABLE "things" ("id" UUID PRIMARY KEY);`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(0);
  });
});

describe("check-migration-safety.sh — destructive migrations block", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeMigrationsDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("exits 2 + reports DROP TABLE", () => {
    writeMigration(
      dir,
      "20260101120000_drop_things",
      `DROP TABLE "things";`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/BLOCKED/);
    expect(r.stderr).toMatch(/DROP/);
  });

  it("exits 2 + reports ALTER ... DROP COLUMN", () => {
    writeMigration(
      dir,
      "20260101120000_drop_col",
      `ALTER TABLE "things" DROP COLUMN "name";`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(2);
    // Match the bash POSIX regex literal as it appears in the
    // operator-facing message — JS regex doesn't grok [[:space:]]
    // so we string-include it.
    expect(r.stderr.includes("DROP[[:space:]]+COLUMN")).toBe(true);
  });

  it("exits 2 + reports unconditional DELETE FROM", () => {
    writeMigration(
      dir,
      "20260101120000_truncate_via_delete",
      `DELETE FROM "audit_logs";`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/unconditional DELETE/);
  });

  it("exits 2 + reports TRUNCATE", () => {
    writeMigration(
      dir,
      "20260101120000_truncate",
      `TRUNCATE TABLE "audit_logs";`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/TRUNCATE/);
  });

  it("exits 2 + reports DROP INDEX (= rebuild cost may stall prod)", () => {
    writeMigration(
      dir,
      "20260101120000_drop_idx",
      `DROP INDEX "things_name_idx";`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(2);
    expect(r.stderr.includes("DROP[[:space:]]+INDEX")).toBe(true);
  });

  it("override env ALLOW_DESTRUCTIVE_MIGRATION=1 lets destructive migration pass", () => {
    writeMigration(
      dir,
      "20260101120000_drop_intentional",
      `ALTER TABLE "things" DROP COLUMN "old_field";`,
    );
    const r = runScript({ migrationsDir: dir, allowDestructive: true });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toMatch(/proceeding under operator opt-in/);
    expect(r.stderr).toMatch(/WARNING/);
    // The override path STILL surfaces what was matched, so the
    // operator can sanity-check before pushing.
    expect(r.stderr.includes("DROP[[:space:]]+COLUMN")).toBe(true);
  });
});

describe("check-migration-safety.sh — selects the LATEST migration only", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeMigrationsDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("ignores older migrations even if they contain DROP", () => {
    // Old destructive migration — should NOT trip the guard.
    writeMigration(
      dir,
      "20240101120000_old_drop",
      `DROP TABLE "old_things";`,
    );
    // New safe migration — should pass.
    writeMigration(
      dir,
      "20260501120000_add_safe",
      `CREATE TABLE "new_things" ("id" UUID PRIMARY KEY);`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(0);
  });

  it("blocks when the LATEST is destructive even if older were safe", () => {
    writeMigration(
      dir,
      "20240101120000_old_safe",
      `CREATE TABLE "things" ("id" UUID);`,
    );
    writeMigration(
      dir,
      "20260501120000_new_drop",
      `DROP TABLE "things";`,
    );
    const r = runScript({ migrationsDir: dir });
    expect(r.exitCode).toBe(2);
  });
});
