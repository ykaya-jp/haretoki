/**
 * Track C-1 family-invitation tunables — pure constants only.
 *
 * Lives outside the `"use server"` boundary so unit tests can assert
 * the designer-warning-spec'd values (token strength, expiry, rate
 * limit, showcase dimension list) without standing up the server
 * action. Server-side code in
 * `src/server/actions/family-invitations.ts` re-exports / consumes
 * these so a single edit here propagates everywhere.
 */

import type { ScoreDimension } from "@/generated/prisma/client";

/** 32 bytes = 256 bits of entropy → 64 hex chars. Designer minimum. */
export const FAMILY_TOKEN_BYTES = 32;

/** 30 days. Leaked URL has a hard ceiling without owner action. */
export const FAMILY_DEFAULT_EXPIRY_DAYS = 30;

/** Public consume path — designer warning: cap per IP at 10/min. */
export const FAMILY_VIEW_RATE_LIMIT = {
  limit: 10,
  windowMs: 60_000,
} as const;

/**
 * Curated dimensions exposed to the family read-only view. Critical
 * payload contract: `cost` / `cost_contract` are intentionally
 * excluded — the family page must never reveal pricing.
 */
export const FAMILY_SHOWCASE_DIMENSIONS: ReadonlyArray<{
  key: ScoreDimension;
  label: string;
}> = [
  { key: "atmosphere", label: "雰囲気" },
  { key: "ceremony_space", label: "挙式会場" },
  { key: "banquet_space", label: "披露宴会場" },
  { key: "cuisine", label: "お料理" },
  { key: "hospitality", label: "おもてなし" },
  { key: "photo_video", label: "写真・映像" },
];
