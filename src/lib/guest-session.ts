/**
 * F4 — Level 1 Guest Session (httpOnly cookie, HMAC-SHA256 signed).
 *
 * Purpose: let a partner tap an invitation link and browse the project in
 * read-only mode without creating a Haretoki account. A short-lived (24h)
 * cookie holds the projectId + invitation token + a simple screenCount so
 * the guest UI can detect "is this their first screen?" for soft upgrade
 * hints without any server-side session storage.
 *
 * Security model:
 *   - Cookie is httpOnly + SameSite=Lax + Secure in prod → mitigates XSS
 *     and CSRF exfiltration.
 *   - Payload is HMAC-SHA256 signed. `keyId` points at one of two parallel
 *     secrets (`GUEST_COOKIE_SECRET_K1` / `_K2`), so we can rotate keys
 *     by promoting a new one to K1 and keeping K2 valid for 24h to cover
 *     in-flight sessions.
 *   - Payload stores **projectId + token**, not any user PII. Even a
 *     leaked cookie only grants read-only access to one project.
 *   - We do NOT consume the invitation token on Level 1 — a 24h cookie
 *     simply rides on top. That's deliberate: viewing isn't committing.
 *
 * Non-goals:
 *   - Cross-device continuity. If the partner opens the link on a new
 *     device, they re-enter Level 1 by re-tapping the token.
 *   - Multi-project guest sessions. A newer invite overwrites the cookie
 *     (the UI shows a confirm first; see §4.5 of the design doc).
 *
 * References:
 *   - Node HMAC: https://nodejs.org/api/crypto.html#class-hmac
 *   - base64url: RFC 4648 §5 — URL-safe alphabet, no padding.
 */

import { createHmac, timingSafeEqual } from "crypto";

export const GUEST_COOKIE_NAME = "htk_guest";
export const GUEST_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60; // 24h

// Used as a hard stop on screenCount to avoid pathological growth (e.g. a
// crawler replaying the link). Legit guest flows see <100 screens.
const MAX_SCREEN_COUNT = 10_000;

export type GuestKeyId = "k1" | "k2";

export interface GuestSessionPayload {
  /** Which secret generation signed this payload. */
  keyId: GuestKeyId;
  /** ProjectInvitation.token (64 hex chars). */
  token: string;
  /** Denormalised so we can short-circuit DB lookups on each screen. */
  projectId: string;
  /** Incremented every time guest routes write back the cookie. */
  screenCount: number;
  /** ISO-8601 UTC. */
  lastSeenAt: string;
  /** ISO-8601 UTC. */
  issuedAt: string;
  /** ISO-8601 UTC — issuedAt + 24h. */
  expiresAt: string;
}

export interface GuestSessionVerifyResult {
  payload: GuestSessionPayload;
  /** True iff the payload was signed by a non-current key (K2 today) and
   *  the caller should re-issue with the current key. */
  needsRotation: boolean;
}

// ----- Secret resolution ---------------------------------------------------

/**
 * Map keyId to the current secret value. Reads env on each call so tests
 * and rotations pick up changes without needing a restart hook.
 *
 * In dev / CI we allow a fallback value so the app boots even without
 * rotating secrets configured; the fallback is intentionally short and
 * low-entropy so no-one mistakes it for production-grade.
 */
export function getGuestSecret(keyId: GuestKeyId): string | null {
  const envKey = keyId === "k1" ? "GUEST_COOKIE_SECRET_K1" : "GUEST_COOKIE_SECRET_K2";
  const value = process.env[envKey];
  if (value && value.length >= 16) return value;
  // Dev-only fallback. Production must set both K1 and K2 with
  // `openssl rand -hex 32`. We still accept verification with the fallback
  // so tests don't need to mutate process.env aggressively.
  if (process.env.NODE_ENV !== "production") {
    return `dev-fallback-${keyId}-do-not-use-in-prod`;
  }
  return null;
}

/** The currently-active key for **signing** fresh cookies. */
export function currentGuestKeyId(): GuestKeyId {
  return "k1";
}

// ----- base64url helpers ---------------------------------------------------

function toB64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Buffer {
  // Re-pad so Buffer.from("base64") accepts it.
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

// ----- Sign / Verify -------------------------------------------------------

function computeSignature(payloadB64: string, secret: string): string {
  return toB64Url(createHmac("sha256", secret).update(payloadB64).digest());
}

/**
 * Encode + sign a payload. Always signs with the **current** key (k1).
 */
export function signGuestSession(payload: GuestSessionPayload): string {
  const secret = getGuestSecret(payload.keyId);
  if (!secret) {
    throw new Error(`Guest secret for ${payload.keyId} is not configured`);
  }
  const payloadB64 = toB64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = computeSignature(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/**
 * Parse + verify a cookie value. Returns null on ANY failure so the caller
 * can treat "unsigned / stale / tampered" uniformly (no oracle).
 *
 * `needsRotation` lets the caller re-issue with the current key when the
 * cookie is still valid but signed with the previous generation.
 */
export function verifyGuestSession(
  raw: string | undefined | null,
  now: Date = new Date(),
): GuestSessionVerifyResult | null {
  if (!raw || typeof raw !== "string") return null;

  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, providedSigB64] = parts;
  if (!payloadB64 || !providedSigB64) return null;

  let parsed: GuestSessionPayload;
  try {
    const json = fromB64Url(payloadB64).toString("utf8");
    parsed = JSON.parse(json) as GuestSessionPayload;
  } catch {
    return null;
  }

  if (parsed.keyId !== "k1" && parsed.keyId !== "k2") return null;
  if (typeof parsed.token !== "string" || !/^[a-f0-9]{64}$/.test(parsed.token)) {
    return null;
  }
  if (typeof parsed.projectId !== "string" || parsed.projectId.length === 0) {
    return null;
  }
  if (
    typeof parsed.screenCount !== "number" ||
    !Number.isInteger(parsed.screenCount) ||
    parsed.screenCount < 0 ||
    parsed.screenCount > MAX_SCREEN_COUNT
  ) {
    return null;
  }

  const secret = getGuestSecret(parsed.keyId);
  if (!secret) return null;

  const expectedSig = computeSignature(payloadB64, secret);
  // Constant-time compare to keep the signature opaque to timing attackers.
  // Both sides are base64url so the byte lengths always match when keys match.
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(providedSigB64);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  // Expiry check after signature so attackers can't distinguish
  // "bad sig" from "expired" by response timing.
  const exp = Date.parse(parsed.expiresAt);
  if (!Number.isFinite(exp) || exp <= now.getTime()) return null;

  return {
    payload: parsed,
    needsRotation: parsed.keyId !== currentGuestKeyId(),
  };
}

// ----- Higher-level helpers ------------------------------------------------

export interface NewGuestSessionInput {
  token: string;
  projectId: string;
  now?: Date;
}

/**
 * Build a fresh payload ready for `signGuestSession`. screenCount starts at
 * 1 (this request counts as one screen) and lastSeenAt = issuedAt.
 */
export function buildGuestSession(input: NewGuestSessionInput): GuestSessionPayload {
  const now = input.now ?? new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + GUEST_COOKIE_MAX_AGE_SECONDS * 1000).toISOString();
  return {
    keyId: currentGuestKeyId(),
    token: input.token,
    projectId: input.projectId,
    screenCount: 1,
    lastSeenAt: issuedAt,
    issuedAt,
    expiresAt,
  };
}

/**
 * Increment screenCount + bump lastSeenAt on an existing verified payload.
 * Returns a brand-new object so callers can pass it straight to `signGuestSession`.
 */
export function bumpGuestSession(
  payload: GuestSessionPayload,
  now: Date = new Date(),
): GuestSessionPayload {
  return {
    ...payload,
    // If rotating, re-sign with current key.
    keyId: currentGuestKeyId(),
    screenCount: Math.min(payload.screenCount + 1, MAX_SCREEN_COUNT),
    lastSeenAt: now.toISOString(),
  };
}

/**
 * Serialize cookie options (used by route handlers that call
 * `cookies().set(...)` — Next.js' ResponseCookies API takes the same shape).
 */
export function guestCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
  };
}
