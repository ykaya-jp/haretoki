import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Track C-1 server-action coverage.
 *
 * Pinned per the designer warning surface:
 *   1. token strength = 64 hex chars (256-bit) — `createFamilyInvitation`
 *      always produces a token of the spec'd shape (otherwise an
 *      attacker can brute-force the URL space)
 *   2. expiry default = 30 days — leaked URL has a hard ceiling
 *   3. issuing replaces any prior live link in a transaction — no
 *      window where two active links share a project
 *   4. revoke is auth-scoped — passing someone else's id is silent
 *      (count=0 returned), never echoes "no such row"
 *   5. consume rejects: token not 64-hex, unknown token, revoked
 *      token, expired token, missing decision (project where the
 *      owner shared too early)
 *   6. consume rate-limits per-IP — 11th hit in the window returns
 *      `rate-limited` without touching the DB
 *   7. consume payload NEVER includes cost / private memo / private
 *      ratings — only the curated SHOWCASE_DIMENSIONS subset
 *   8. audit row written with the right action verb on every code path
 */

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockDecisionFindUnique = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    familyInvitation: {
      create: (...a: unknown[]) => mockCreate(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      findMany: vi.fn(async () => []),
    },
    decision: {
      findUnique: (...a: unknown[]) => mockDecisionFindUnique(...a),
    },
    $transaction: (cb: (tx: unknown) => unknown) =>
      mockTransaction(cb).then((r: unknown) => r),
  },
}));

const mockRequireUser = vi.fn();
const mockRequireOwner = vi.fn();
vi.mock("@/server/auth", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  requireOwner: (...a: unknown[]) => mockRequireOwner(...a),
}));

const mockRecordAudit = vi.fn();
vi.mock("@/server/audit", () => ({
  recordAudit: (...a: unknown[]) => mockRecordAudit(...a),
  redactIp: (ip: string | null | undefined) =>
    ip ? `${ip.split(".").slice(0, 3).join(".")}.0/24` : null,
  extractRequestMeta: (req: { headers: { get: (n: string) => string | null } }) => ({
    ip: req.headers.get("x-forwarded-for") ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
  captureMessage: vi.fn(),
}));

const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
  rateLimitErrorMessage: vi.fn(() => null),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

import {
  createFamilyInvitation,
  revokeFamilyInvitation,
  consumeFamilyInvitationView,
} from "@/server/actions/family-invitations";
import {
  FAMILY_TOKEN_BYTES,
  FAMILY_DEFAULT_EXPIRY_DAYS,
  FAMILY_VIEW_RATE_LIMIT,
  FAMILY_SHOWCASE_DIMENSIONS,
} from "@/lib/family-invitations-config";

// Valid UUID v4 fixtures (version nibble = 4, variant nibble in 8-b range)
// — zod's .uuid() rejects non-v4 strings, so the bare 1-1-1-1-1 etc. shape
// won't pass. These all parse cleanly while staying obviously synthetic.
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const INVITATION_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: USER_ID });
  mockRequireOwner.mockResolvedValue({ projectId: PROJECT_ID });
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
  mockHeaders.mockResolvedValue({
    get: (name: string) => {
      const map: Record<string, string> = {
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "Mozilla/5.0 family",
      };
      return map[name.toLowerCase()] ?? null;
    },
  });
});

describe("createFamilyInvitation — designer warning: token strength + expiry", () => {
  it("generates a 64-hex token (256-bit entropy → ≥ 32 byte requirement)", async () => {
    let capturedToken = "";
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        familyInvitation: {
          updateMany: async () => ({ count: 0 }),
          create: async (args: { data: { token: string } }) => {
            capturedToken = args.data.token;
            return {
              id: INVITATION_ID,
              token: args.data.token,
              expiresAt: new Date("2026-06-01T00:00:00Z"),
              createdAt: new Date("2026-05-02T00:00:00Z"),
              revokedAt: null,
              viewCount: 0,
              lastViewedAt: null,
            };
          },
        },
      };
      return cb(tx);
    });

    const result = await createFamilyInvitation();

    expect(result.ok).toBe(true);
    expect(capturedToken).toMatch(/^[0-9a-f]{64}$/);
    expect(capturedToken.length).toBe(64);
    // 32 bytes is the minimum the designer warning requires.
    expect(FAMILY_TOKEN_BYTES).toBeGreaterThanOrEqual(32);
  });

  it("sets expiresAt to 30 days from now", async () => {
    let capturedExpires: Date | null = null;
    const before = Date.now();
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        familyInvitation: {
          updateMany: async () => ({ count: 0 }),
          create: async (args: { data: { expiresAt: Date } }) => {
            capturedExpires = args.data.expiresAt;
            return {
              id: INVITATION_ID,
              token: "0".repeat(64),
              expiresAt: args.data.expiresAt,
              createdAt: new Date(),
              revokedAt: null,
              viewCount: 0,
              lastViewedAt: null,
            };
          },
        },
      };
      return cb(tx);
    });

    await createFamilyInvitation();
    const after = Date.now();

    expect(capturedExpires).not.toBeNull();
    const days = (capturedExpires!.getTime() - before) / (24 * 60 * 60 * 1000);
    const daysAfter = (capturedExpires!.getTime() - after) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(29.99);
    expect(daysAfter).toBeLessThanOrEqual(30.01);
    expect(FAMILY_DEFAULT_EXPIRY_DAYS).toBe(30);
  });

  it("revokes prior live links in the same transaction (no two-active window)", async () => {
    let updateCalled = false;
    let createCalled = false;
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        familyInvitation: {
          updateMany: async (args: { data: { revokedAt: Date; revokedBy: string } }) => {
            // Must be called BEFORE create — verify with a flag.
            expect(createCalled).toBe(false);
            expect(args.data.revokedAt).toBeInstanceOf(Date);
            expect(args.data.revokedBy).toBe(USER_ID);
            updateCalled = true;
            return { count: 1 };
          },
          create: async () => {
            expect(updateCalled).toBe(true);
            createCalled = true;
            return {
              id: INVITATION_ID,
              token: "a".repeat(64),
              expiresAt: new Date("2026-06-01"),
              createdAt: new Date(),
              revokedAt: null,
              viewCount: 0,
              lastViewedAt: null,
            };
          },
        },
      };
      return cb(tx);
    });

    await createFamilyInvitation();
    expect(updateCalled).toBe(true);
    expect(createCalled).toBe(true);
  });

  it("writes audit row with action=family.invitation.created", async () => {
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        familyInvitation: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({
            id: INVITATION_ID,
            token: "f".repeat(64),
            expiresAt: new Date("2026-06-01"),
            createdAt: new Date(),
            revokedAt: null,
            viewCount: 0,
            lastViewedAt: null,
          }),
        },
      };
      return cb(tx);
    });

    await createFamilyInvitation();

    expect(mockRecordAudit).toHaveBeenCalledTimes(1);
    expect(mockRecordAudit.mock.calls[0][0]).toMatchObject({
      action: "family.invitation.created",
      actorId: USER_ID,
      actorRole: "user",
      target: { type: "family_invitation", id: INVITATION_ID },
    });
  });
});

describe("revokeFamilyInvitation — auth scoping", () => {
  it("rejects malformed UUID without touching the DB", async () => {
    const result = await revokeFamilyInvitation({ id: "not-a-uuid" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/不正/);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("auth-scopes the update so a foreign id silently does nothing (no enumeration oracle)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const result = await revokeFamilyInvitation({ id: INVITATION_ID });

    expect(result.ok).toBe(true);
    // Critical: returns ok=true even when count=0 so an attacker can't
    // tell "wrong project" from "id doesn't exist" from "already revoked".
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany.mock.calls[0][0].where).toEqual({
      id: INVITATION_ID,
      projectId: PROJECT_ID,
      revokedAt: null,
    });
    // No audit row when count=0 (nothing actually changed).
    expect(mockRecordAudit).not.toHaveBeenCalled();
  });

  it("writes audit row when revoke actually flips a row", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await revokeFamilyInvitation({ id: INVITATION_ID });

    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "family.invitation.revoked",
        actorId: USER_ID,
        target: { type: "family_invitation", id: INVITATION_ID },
      }),
    );
  });
});

describe("consumeFamilyInvitationView — designer warning surface", () => {
  it("rejects malformed token shape WITHOUT touching the DB or rate limiter", async () => {
    const result = await consumeFamilyInvitationView("nope");
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rate-limits per IP — 11th hit gets rate-limited reason", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSec: 42 });

    const result = await consumeFamilyInvitationView("a".repeat(64));

    expect(result).toEqual({ ok: false, reason: "rate-limited" });
    // Critical: never even probe the DB when rate-limited (otherwise
    // the limit doesn't actually relieve DB pressure).
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(FAMILY_VIEW_RATE_LIMIT.limit).toBe(10);
  });

  it("returns not-found for unknown token (no enumeration oracle)", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await consumeFamilyInvitationView("b".repeat(64));
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns revoked when revokedAt is set (distinct from not-found for the page UI, identical to user)", async () => {
    mockFindUnique.mockResolvedValue({
      id: INVITATION_ID,
      projectId: PROJECT_ID,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(Date.now() - 60_000),
    });
    const result = await consumeFamilyInvitationView("c".repeat(64));
    expect(result).toEqual({ ok: false, reason: "revoked" });
    // Decision is never queried for revoked links (saves a round trip).
    expect(mockDecisionFindUnique).not.toHaveBeenCalled();
  });

  it("returns expired when expiresAt is in the past", async () => {
    mockFindUnique.mockResolvedValue({
      id: INVITATION_ID,
      projectId: PROJECT_ID,
      expiresAt: new Date(Date.now() - 1),
      revokedAt: null,
    });
    const result = await consumeFamilyInvitationView("d".repeat(64));
    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(mockDecisionFindUnique).not.toHaveBeenCalled();
  });

  it("returns not-found when project has no Decision yet (no early-leak oracle)", async () => {
    mockFindUnique.mockResolvedValue({
      id: INVITATION_ID,
      projectId: PROJECT_ID,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mockDecisionFindUnique.mockResolvedValue(null);
    const result = await consumeFamilyInvitationView("e".repeat(64));
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns ok payload — venue + curated scores ONLY (cost dimension excluded)", async () => {
    mockFindUnique.mockResolvedValue({
      id: INVITATION_ID,
      projectId: PROJECT_ID,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mockDecisionFindUnique.mockResolvedValue({
      decidedAt: new Date(Date.UTC(2026, 5, 14, 5, 0, 0)),
      rationale: "ふたりの第一印象が忘れられなかったから",
      venue: {
        name: "ガーデンテラス青山",
        location: "東京都港区南青山",
        scores: [
          { dimension: "atmosphere", score: 4.5 },
          { dimension: "cuisine", score: 5.0 },
          { dimension: "hospitality", score: 4.0 },
          // Cost is NOT in SHOWCASE_DIMENSIONS — even if Prisma returned
          // it (e.g. a buggy where clause), the picker filters it out.
          { dimension: "cost", score: 1.0 },
        ],
      },
    });
    mockUpdate.mockResolvedValue({});

    const result = await consumeFamilyInvitationView("f".repeat(64));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.venueName).toBe("ガーデンテラス青山");
    expect(result.payload.venueLocation).toBe("東京都港区南青山");
    expect(result.payload.rationale).toMatch(/第一印象/);
    expect(result.payload.decidedOnLabel).toBe("6月14日");
    // Cost MUST NOT leak.
    expect(
      result.payload.scores.find((s) => /cost|費用/.test(s.dimension)),
    ).toBeUndefined();
    // Curated subset only — labels match SHOWCASE_DIMENSIONS.
    expect(
      result.payload.scores.every((s) =>
        ["雰囲気", "挙式会場", "披露宴会場", "お料理", "おもてなし", "写真・映像"].includes(
          s.dimension,
        ),
      ),
    ).toBe(true);
  });

  it("bumps view count via { increment: 1 } so concurrent hits don't tear", async () => {
    mockFindUnique.mockResolvedValue({
      id: INVITATION_ID,
      projectId: PROJECT_ID,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mockDecisionFindUnique.mockResolvedValue({
      decidedAt: new Date(),
      rationale: null,
      venue: { name: "Test", location: null, scores: [] },
    });
    mockUpdate.mockResolvedValue({});

    await consumeFamilyInvitationView("9".repeat(64));

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0];
    expect(args.where).toEqual({ id: INVITATION_ID });
    expect(args.data.viewCount).toEqual({ increment: 1 });
    expect(args.data.lastViewedAt).toBeInstanceOf(Date);
    // ip hash present (sha256-first-16 of redacted /24 = 16 hex chars)
    expect(args.data.lastViewedIpHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("audit row written with action=family.invitation.viewed on success", async () => {
    mockFindUnique.mockResolvedValue({
      id: INVITATION_ID,
      projectId: PROJECT_ID,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mockDecisionFindUnique.mockResolvedValue({
      decidedAt: new Date(),
      rationale: null,
      venue: { name: "Test", location: null, scores: [] },
    });
    mockUpdate.mockResolvedValue({});

    await consumeFamilyInvitationView("8".repeat(64));

    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "family.invitation.viewed",
        target: { type: "family_invitation", id: INVITATION_ID },
        actorRole: "system",
      }),
    );
  });
});

describe("Designer-spec constants", () => {
  it("token bytes ≥ 32 (256 bits)", () => {
    expect(FAMILY_TOKEN_BYTES).toBeGreaterThanOrEqual(32);
  });
  it("rate limit window is 60 seconds, limit is 10 hits", () => {
    expect(FAMILY_VIEW_RATE_LIMIT).toEqual({
      limit: 10,
      windowMs: 60_000,
    });
  });
  it("showcase dimensions exclude cost (designer payload contract)", () => {
    expect(
      FAMILY_SHOWCASE_DIMENSIONS.some((d) =>
        ["cost", "cost_contract"].includes(d.key),
      ),
    ).toBe(false);
  });
});
