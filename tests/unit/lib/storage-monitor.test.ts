import { describe, it, expect } from "vitest";
import {
  buildStorageListUrl,
  classifyStorageUsage,
  DEFAULT_STORAGE_LIMIT_BYTES,
  formatBytes,
  KNOWN_BUCKETS,
  parseStorageListResponse,
  STORAGE_CRITICAL_THRESHOLD_PCT,
  STORAGE_WARN_THRESHOLD_PCT,
} from "@/lib/storage-monitor";

/**
 * Phase 4 storage usage monitor — pin every divisor edge so the
 * /admin/health card never displays NaN, and pin the threshold
 * boundaries because Sentry alert routing will key off them in a
 * later PR.
 */

describe("classifyStorageUsage — boundary thresholds", () => {
  it("threshold constants match the documented values (alert routing depends on them)", () => {
    expect(STORAGE_WARN_THRESHOLD_PCT).toBe(80);
    expect(STORAGE_CRITICAL_THRESHOLD_PCT).toBe(90);
    expect(DEFAULT_STORAGE_LIMIT_BYTES).toBe(1024 * 1024 * 1024);
  });

  it("returns ok for usage below 80%", () => {
    const r = classifyStorageUsage(100, 1000);
    expect(r.status).toBe("ok");
    expect(r.pct).toBe(10);
  });

  it("returns warn at exactly 80% (inclusive boundary)", () => {
    const r = classifyStorageUsage(800, 1000);
    expect(r.status).toBe("warn");
    expect(r.pct).toBe(80);
  });

  it("returns warn between 80% and 90%", () => {
    expect(classifyStorageUsage(850, 1000).status).toBe("warn");
    expect(classifyStorageUsage(899, 1000).status).toBe("warn");
  });

  it("returns critical at exactly 90% (inclusive boundary)", () => {
    const r = classifyStorageUsage(900, 1000);
    expect(r.status).toBe("critical");
    expect(r.pct).toBe(90);
  });

  it("returns critical above 90% (clamping NOT applied — operator must see the actual %)", () => {
    expect(classifyStorageUsage(950, 1000).status).toBe("critical");
    // Defensive: even over-budget (= corruption / accounting bug) still
    // reads as a real number, not Infinity / NaN.
    const overBudget = classifyStorageUsage(2000, 1000);
    expect(overBudget.status).toBe("critical");
    expect(overBudget.pct).toBe(200);
  });

  it("returns ok with pct=0 when limit is 0 (no panic-alert during region migration)", () => {
    // CRITICAL: Supabase Management API occasionally returns limit=0
    // during region migrations. Treating that as 100% would page the
    // operator falsely. Defensive: report ok + 0%.
    const r = classifyStorageUsage(500, 0);
    expect(r.status).toBe("ok");
    expect(r.pct).toBe(0);
  });

  it("returns ok with pct=0 on NaN / Infinity inputs", () => {
    expect(classifyStorageUsage(NaN, 1000).status).toBe("ok");
    expect(classifyStorageUsage(100, Infinity).status).toBe("ok");
  });

  it("rounds pct to 1 decimal", () => {
    // 333 / 1000 = 33.3% exact
    expect(classifyStorageUsage(333, 1000).pct).toBe(33.3);
    // 1 / 3 = 33.333% → 33.3
    expect(classifyStorageUsage(1, 3).pct).toBe(33.3);
  });
});

describe("formatBytes", () => {
  it("returns '—' for non-finite or negative", () => {
    expect(formatBytes(NaN)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Infinity)).toBe("—");
  });

  it("returns '0 B' exactly for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("uses B for sub-KiB values, no decimals", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("uses KiB at 1024+ boundary, no decimals", () => {
    expect(formatBytes(1024)).toBe("1 KiB");
    expect(formatBytes(1024 * 500)).toBe("500 KiB");
  });

  it("uses MiB+ with 1 decimal", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MiB");
    expect(formatBytes(1024 * 1024 * 1.5)).toBe("1.5 MiB");
  });

  it("uses GiB for 1+ GB", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GiB");
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe("2.5 GiB");
  });

  it("clamps at TiB (highest unit displayed)", () => {
    const oneTiB = 1024 * 1024 * 1024 * 1024;
    expect(formatBytes(oneTiB)).toBe("1.0 TiB");
    expect(formatBytes(oneTiB * 100)).toBe("100.0 TiB");
  });
});

describe("parseStorageListResponse", () => {
  it("returns 0 / 0 for empty list", () => {
    expect(parseStorageListResponse([])).toEqual({
      totalBytes: 0,
      fileCount: 0,
    });
  });

  it("sums object metadata.size, ignoring folders (= empty metadata)", () => {
    const r = parseStorageListResponse([
      { name: "img1.jpg", metadata: { size: 100 } },
      { name: "img2.jpg", metadata: { size: 200 } },
      // folder — Supabase returns these with no metadata
      { name: "subfolder/", metadata: null },
      { name: "subfolder2/" },
    ]);
    expect(r).toEqual({ totalBytes: 300, fileCount: 2 });
  });

  it("ignores rows with size = 0 (= edge case, treat as folder)", () => {
    const r = parseStorageListResponse([
      { name: "good.jpg", metadata: { size: 500 } },
      { name: "zero-byte.txt", metadata: { size: 0 } },
    ]);
    expect(r).toEqual({ totalBytes: 500, fileCount: 1 });
  });

  it("ignores rows with negative size (= corruption defence)", () => {
    const r = parseStorageListResponse([
      { name: "good.jpg", metadata: { size: 500 } },
      { name: "bad.jpg", metadata: { size: -100 } },
    ]);
    expect(r).toEqual({ totalBytes: 500, fileCount: 1 });
  });

  it("ignores rows where metadata.size is not a number", () => {
    const r = parseStorageListResponse([
      { name: "ok.jpg", metadata: { size: 200 } },
      // @ts-expect-error — testing runtime guard
      { name: "stringy.jpg", metadata: { size: "200" } },
      { name: "missing.jpg", metadata: { size: null } },
    ]);
    expect(r).toEqual({ totalBytes: 200, fileCount: 1 });
  });
});

describe("buildStorageListUrl", () => {
  it("composes /storage/v1/object/list/{bucket} on the supabase URL", () => {
    expect(
      buildStorageListUrl("https://abc.supabase.co", "venue-photos"),
    ).toBe("https://abc.supabase.co/storage/v1/object/list/venue-photos");
  });

  it("strips trailing slash on the supabase URL", () => {
    expect(
      buildStorageListUrl("https://abc.supabase.co/", "venue-photos"),
    ).toBe("https://abc.supabase.co/storage/v1/object/list/venue-photos");
  });

  it("URL-encodes special chars in the bucket name (defensive)", () => {
    // Real bucket names are kebab-case so this never fires in
    // practice — but a future "weird/name" bucket would still produce
    // a valid URL.
    expect(buildStorageListUrl("https://abc.supabase.co", "weird/name"))
      .toBe("https://abc.supabase.co/storage/v1/object/list/weird%2Fname");
  });
});

describe("KNOWN_BUCKETS contract (parity with src/lib/supabase/storage.ts)", () => {
  it("contains the 3 buckets actually used in the codebase", () => {
    // Pinned so a refactor that removes a bucket from src/lib/supabase
    // /storage.ts but forgets to remove it here surfaces as a failing
    // test. Inverse drift (= a new bucket added there but missing
    // here) would silently miss the storage probe — the grep'd
    // sources at the time of writing were venue-photos, visit-photos,
    // estimates.
    expect([...KNOWN_BUCKETS].sort()).toEqual([
      "estimates",
      "venue-photos",
      "visit-photos",
    ]);
  });
});
