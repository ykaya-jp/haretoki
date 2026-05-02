/**
 * Pure helpers for the Supabase storage usage monitor.
 *
 * Lives in `lib/` (no Prisma / no fetch) so the spec runner pins the
 * threshold math + parser without standing up the runtime. The page +
 * cron each do their own I/O and pass raw responses in.
 *
 * Threshold rationale (Beta phase, free-tier 1 GB ceiling):
 *   - ok       (< 80%): nominal — capacity headroom for normal couples
 *   - warn     (≥ 80%): operator should look — at current growth we
 *     have ~weeks before the ceiling. Sentry warning at p3-digest.
 *   - critical (≥ 90%): user-facing failures imminent (Storage upload
 *     starts returning 4xx when the project hits the limit). Sentry
 *     warning at p2-email + plan migration to Pro tier (= more storage).
 *
 * The paginated `parseStorageListResponse` is intentionally bounded —
 * we read the first page (≤ 1000 objects) per bucket to keep the live
 * probe cheap. For 1000+ object buckets this gives a "lower bound";
 * real total comes from Supabase Management API which is a separate
 * tool surface (admin token, not anon key). The /admin/health card
 * declares the approximation honestly in its inline copy.
 */

export type StorageStatus = "ok" | "warn" | "critical";

/**
 * Default ceiling for Supabase free tier. Override per-deployment via
 * `SUPABASE_STORAGE_LIMIT_BYTES` env when you migrate to Pro (= 100 GB
 * default). 1 GB = 2^30 bytes per Supabase docs (decimal not binary
 * for the displayed limit, but binary for the threshold math).
 */
export const DEFAULT_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

export const STORAGE_WARN_THRESHOLD_PCT = 80;
export const STORAGE_CRITICAL_THRESHOLD_PCT = 90;

/**
 * Classify total / limit as ok | warn | critical. Defensive on the
 * divisor (returns `ok` when limit ≤ 0 — Supabase Management API
 * occasionally returns 0 during region migrations and we'd rather
 * NOT panic-alert in that case).
 */
export function classifyStorageUsage(
  usedBytes: number,
  limitBytes: number = DEFAULT_STORAGE_LIMIT_BYTES,
): { status: StorageStatus; pct: number } {
  if (
    !Number.isFinite(usedBytes) ||
    !Number.isFinite(limitBytes) ||
    limitBytes <= 0
  ) {
    return { status: "ok", pct: 0 };
  }
  const pct = Math.round((usedBytes / limitBytes) * 1000) / 10;
  if (pct >= STORAGE_CRITICAL_THRESHOLD_PCT) {
    return { status: "critical", pct };
  }
  if (pct >= STORAGE_WARN_THRESHOLD_PCT) {
    return { status: "warn", pct };
  }
  return { status: "ok", pct };
}

/**
 * Pretty-printer for the dashboard. Goes binary (KiB / MiB / GiB) at
 * 1024 boundaries because the operator is comparing against the
 * Supabase project quota which is also binary internally.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"] as const;
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx++;
  }
  // 0 decimals for B / KiB (whole numbers read cleanly), 1 decimal
  // for MiB+ (1.3 GiB beats 1342 MiB on a glance).
  const decimals = unitIdx <= 1 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIdx]}`;
}

/**
 * One Supabase Storage object as returned by `POST /storage/v1/object/list`.
 * The full shape has more fields; we only need `name` + `metadata.size`.
 */
export interface StorageObjectShape {
  name: string;
  metadata?: { size?: number | null } | null;
}

/**
 * Sum the size of every object in a `list` page. Skips folders
 * (empty metadata or size = null) so the total reflects only billable
 * file bytes. Returns the count + sum so the caller can detect "page
 * was full" (= count === 1000) and surface a "lower bound" badge.
 */
export function parseStorageListResponse(rows: ReadonlyArray<StorageObjectShape>): {
  totalBytes: number;
  fileCount: number;
} {
  let totalBytes = 0;
  let fileCount = 0;
  for (const row of rows) {
    const size = row.metadata?.size;
    if (typeof size !== "number" || size <= 0) continue;
    totalBytes += size;
    fileCount += 1;
  }
  return { totalBytes, fileCount };
}

/**
 * Bucket names actually used by Haretoki. Centralised here so the
 * /admin/health probe + future bucket additions stay in lock-step
 * with `src/lib/supabase/storage.ts`. Adding a new bucket = one
 * edit here, the dashboard renders it automatically.
 */
export const KNOWN_BUCKETS = [
  "venue-photos",
  "visit-photos",
  "estimates",
] as const;

export type KnownBucket = (typeof KNOWN_BUCKETS)[number];

/**
 * Build the Supabase storage list URL for one bucket. Used by the
 * live probe + tests pin the URL composition so a path drift
 * surfaces as one obvious failure.
 */
export function buildStorageListUrl(supabaseUrl: string, bucket: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/list/${encodeURIComponent(bucket)}`;
}
