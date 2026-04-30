import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  GUEST_COOKIE_MAX_AGE_SECONDS,
  GUEST_COOKIE_NAME,
  buildGuestSession,
  bumpGuestSession,
  currentGuestKeyId,
  guestCookieOptions,
  signGuestSession,
  verifyGuestSession,
  type GuestSessionPayload,
} from "@/lib/guest-session";

// Realistic 64-hex token shape for positive-path tests.
const VALID_TOKEN = "a".repeat(64);
const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => {
  setEnv({
    GUEST_COOKIE_SECRET_K1: "k1-test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    GUEST_COOKIE_SECRET_K2: "k2-test-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    NODE_ENV: "test",
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("guest-session / sign + verify happy path", () => {
  it("issues a cookie value whose payload round-trips via verifyGuestSession", () => {
    const payload = buildGuestSession({
      token: VALID_TOKEN,
      projectId: PROJECT_ID,
    });
    const cookie = signGuestSession(payload);
    expect(typeof cookie).toBe("string");
    expect(cookie).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const verified = verifyGuestSession(cookie);
    expect(verified).not.toBeNull();
    expect(verified!.payload.projectId).toBe(PROJECT_ID);
    expect(verified!.payload.token).toBe(VALID_TOKEN);
    expect(verified!.payload.screenCount).toBe(1);
    expect(verified!.needsRotation).toBe(false);
  });

  it("guestCookieOptions returns safe defaults (httpOnly, SameSite=Lax, 24h)", () => {
    const opts = guestCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.maxAge).toBe(GUEST_COOKIE_MAX_AGE_SECONDS);
    expect(opts.secure).toBe(false); // non-prod
    expect(GUEST_COOKIE_NAME).toBe("htk_guest");
  });
});

describe("guest-session / signature tamper detection", () => {
  it("rejects a cookie whose payload was mutated after signing", () => {
    const payload = buildGuestSession({
      token: VALID_TOKEN,
      projectId: PROJECT_ID,
    });
    const cookie = signGuestSession(payload);
    const [, sig] = cookie.split(".");

    // Replace the payload with one that grants a *different* projectId.
    const evilPayload: GuestSessionPayload = {
      ...payload,
      projectId: "22222222-2222-2222-2222-222222222222",
    };
    const evilPayloadB64 = Buffer.from(JSON.stringify(evilPayload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tampered = `${evilPayloadB64}.${sig}`;

    expect(verifyGuestSession(tampered)).toBeNull();
  });

  it("rejects malformed cookie shapes (missing dot, wrong arity)", () => {
    expect(verifyGuestSession("")).toBeNull();
    expect(verifyGuestSession(undefined)).toBeNull();
    expect(verifyGuestSession("no-separator")).toBeNull();
    expect(verifyGuestSession("too.many.parts")).toBeNull();
    expect(verifyGuestSession(".only-sig")).toBeNull();
    expect(verifyGuestSession("only-payload.")).toBeNull();
  });
});

describe("guest-session / secret rotation (k1 ↔ k2)", () => {
  it("accepts a cookie signed with k2 and flags needsRotation", () => {
    const payload: GuestSessionPayload = {
      ...buildGuestSession({ token: VALID_TOKEN, projectId: PROJECT_ID }),
      keyId: "k2",
    };
    const cookie = signGuestSession(payload);

    // Current key is k1 → verification should still succeed (k2 is a
    // valid generation) but flag rotation so the caller re-signs.
    const verified = verifyGuestSession(cookie);
    expect(verified).not.toBeNull();
    expect(verified!.payload.keyId).toBe("k2");
    expect(verified!.needsRotation).toBe(true);
    expect(currentGuestKeyId()).toBe("k1");
  });

  it("rejects a cookie whose keyId is unknown (e.g. k3)", () => {
    // Forge a payload with an unsupported keyId; even with a real sig
    // against some other secret, verify must refuse.
    const payload = buildGuestSession({ token: VALID_TOKEN, projectId: PROJECT_ID });
    const evil = { ...payload, keyId: "k3" as unknown as "k1" };
    const payloadB64 = Buffer.from(JSON.stringify(evil))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    // Any signature: we expect keyId check to short-circuit first.
    const cookie = `${payloadB64}.YWJjZGVm`;
    expect(verifyGuestSession(cookie)).toBeNull();
  });

  it("rejects a cookie when the matching secret is unset in prod", () => {
    setEnv({
      NODE_ENV: "production",
      GUEST_COOKIE_SECRET_K1: "k1-prod-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      GUEST_COOKIE_SECRET_K2: undefined, // gone
    });
    // Payload signed against K2 — but K2 secret is missing now.
    setEnv({ GUEST_COOKIE_SECRET_K2: "k2-temp-for-signing-000000000000000000" });
    const payload: GuestSessionPayload = {
      ...buildGuestSession({ token: VALID_TOKEN, projectId: PROJECT_ID }),
      keyId: "k2",
    };
    const cookie = signGuestSession(payload);
    // Remove K2 so verifier can't derive the secret.
    setEnv({ GUEST_COOKIE_SECRET_K2: undefined });
    expect(verifyGuestSession(cookie)).toBeNull();
  });
});

describe("guest-session / screenCount increment", () => {
  it("bumpGuestSession increments screenCount and updates lastSeenAt", () => {
    const t0 = new Date("2026-04-21T10:00:00.000Z");
    const t1 = new Date("2026-04-21T10:30:00.000Z");
    const payload = buildGuestSession({
      token: VALID_TOKEN,
      projectId: PROJECT_ID,
      now: t0,
    });
    expect(payload.screenCount).toBe(1);
    expect(payload.lastSeenAt).toBe(t0.toISOString());

    const bumped = bumpGuestSession(payload, t1);
    expect(bumped.screenCount).toBe(2);
    expect(bumped.lastSeenAt).toBe(t1.toISOString());
    // expiresAt preserved (24h from original issuedAt).
    expect(bumped.expiresAt).toBe(payload.expiresAt);
    // And re-signed with current key.
    expect(bumped.keyId).toBe(currentGuestKeyId());
  });

  it("caps screenCount at MAX_SCREEN_COUNT so a replay loop can't grow it forever", () => {
    const payload: GuestSessionPayload = {
      ...buildGuestSession({ token: VALID_TOKEN, projectId: PROJECT_ID }),
      screenCount: 9_999,
    };
    const once = bumpGuestSession(payload);
    expect(once.screenCount).toBe(10_000);
    const again = bumpGuestSession(once);
    expect(again.screenCount).toBe(10_000); // capped
  });
});

describe("guest-session / expiry enforcement", () => {
  it("rejects a payload whose expiresAt is in the past", () => {
    const past = new Date(Date.now() - 2 * GUEST_COOKIE_MAX_AGE_SECONDS * 1000);
    const payload: GuestSessionPayload = {
      keyId: "k1",
      token: VALID_TOKEN,
      projectId: PROJECT_ID,
      screenCount: 1,
      issuedAt: past.toISOString(),
      lastSeenAt: past.toISOString(),
      expiresAt: past.toISOString(),
    };
    const cookie = signGuestSession(payload);
    expect(verifyGuestSession(cookie)).toBeNull();
  });
});

describe("guest-session / payload shape validation", () => {
  it("rejects a payload with a non-64-hex token", () => {
    const payload: GuestSessionPayload = {
      ...buildGuestSession({ token: VALID_TOKEN, projectId: PROJECT_ID }),
      token: "not-a-token",
    };
    const cookie = signGuestSession(payload);
    expect(verifyGuestSession(cookie)).toBeNull();
  });

  it("rejects a payload with negative or non-integer screenCount", () => {
    const base = buildGuestSession({ token: VALID_TOKEN, projectId: PROJECT_ID });
    const neg = signGuestSession({ ...base, screenCount: -1 });
    expect(verifyGuestSession(neg)).toBeNull();
    const frac = signGuestSession({ ...base, screenCount: 1.5 });
    expect(verifyGuestSession(frac)).toBeNull();
  });
});
