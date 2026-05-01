/**
 * Pure audit helpers — no Prisma / Sentry / framework deps so unit
 * tests can import them without standing up the runtime. The
 * Prisma-touching `recordAudit` lives in `src/server/audit.ts` and
 * re-exports these.
 */

import { createHash } from "crypto";

/**
 * Hash an email so we can correlate audit rows by user without
 * persisting the raw address. 16 hex chars = 64-bit space, far
 * more than enough to avoid collisions across the lifetime of the
 * service.
 */
export function hashEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  return createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

/**
 * Coarsen an IP to its network prefix:
 *   - IPv4 a.b.c.d  → a.b.c.0/24
 *   - IPv6 a:b:c::  → a:b:c::/48 (truncate to first 3 hextets)
 * Returns null when the input doesn't parse — rather than guess we
 * drop the field so the row stays trustworthy.
 */
export function redactIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const cleaned = ip.trim();
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleaned)) {
    const parts = cleaned.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  // IPv6 (very forgiving — hextets separated by colons, possibly with `::`)
  if (cleaned.includes(":")) {
    const expanded = cleaned.split(":").filter(Boolean);
    if (expanded.length >= 3) {
      return `${expanded[0]}:${expanded[1]}:${expanded[2]}::/48`;
    }
  }
  return null;
}

const USER_AGENT_MAX_LEN = 256;

export function truncateUa(ua: string | undefined | null): string | null {
  if (!ua) return null;
  return ua.slice(0, USER_AGENT_MAX_LEN);
}

/**
 * Convenience wrapper that pulls the IP + UA out of a Web Request /
 * NextRequest. Vercel populates `x-forwarded-for` (the first hop is
 * the real client); fall back to `cf-connecting-ip` and finally the
 * remote address header.
 */
export function extractRequestMeta(req: {
  headers: { get: (name: string) => string | null };
}): { ip: string | null; userAgent: string | null } {
  const xff = req.headers.get("x-forwarded-for");
  const ip =
    xff?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent");
  return { ip, userAgent };
}
