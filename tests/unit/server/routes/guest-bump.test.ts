/**
 * Unit tests for POST /invite/[token]/bump Route Handler.
 *
 * Verified behaviours:
 *  1. Valid cookie + live invitation → 200 { ok:true }, screenCount bumped,
 *     cookie written back.
 *  2. Cookie pointing at a different token → 401.
 *  3. Missing / malformed cookie → 401.
 *  4. Consumed invitation → 410.
 *  5. screenCount === 1 triggers recordGuestInvitationView (first-view DB update).
 *  6. screenCount > 1 skips recordGuestInvitationView (idempotency guard).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildGuestSession,
  signGuestSession,
  GUEST_COOKIE_NAME,
} from "@/lib/guest-session";

// ---------- env setup -------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.GUEST_COOKIE_SECRET_K1 =
    "k1-test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  process.env.GUEST_COOKIE_SECRET_K2 =
    "k2-test-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  // NODE_ENV is read-only in TypeScript; it is set to "test" by the test runner.

  // Reset all mocks between tests so call counts don't accumulate.
  mockCookiesGet.mockReset();
  mockCookiesSet.mockReset();
  mockCookiesDelete.mockReset();
  mockInvitationFindUnique.mockReset();
  mockRecordView.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

// ---------- helpers ---------------------------------------------------------

const VALID_TOKEN = "b".repeat(64);
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";

function makeCookie(overrides: Partial<{ token: string; screenCount: number }> = {}) {
  const payload = buildGuestSession({
    token: overrides.token ?? VALID_TOKEN,
    projectId: PROJECT_ID,
  });
  if (overrides.screenCount !== undefined) {
    payload.screenCount = overrides.screenCount;
  }
  return signGuestSession(payload);
}

// ---------- mocks -----------------------------------------------------------

const mockCookiesGet = vi.fn();
const mockCookiesSet = vi.fn();
const mockCookiesDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookiesGet,
    set: mockCookiesSet,
    delete: mockCookiesDelete,
  })),
}));

const mockInvitationFindUnique = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    projectInvitation: {
      findUnique: (args: unknown) => mockInvitationFindUnique(args),
    },
  },
}));

const mockRecordView = vi.fn(async (_token: string) => {});

vi.mock("@/server/actions/invitation-links", () => ({
  recordGuestInvitationView: (token: string) => mockRecordView(token),
}));

// ---------- SUT import (after mocks) ----------------------------------------

const { POST } = await import(
  "@/app/invite/[token]/(guest)/bump/route"
);

// ---------- helpers for calling the handler ---------------------------------

function makeRequest(token: string): Request {
  return new Request(`http://localhost/invite/${token}/bump`, { method: "POST" });
}

function makeParams(token: string): { params: Promise<{ token: string }> } {
  return { params: Promise.resolve({ token }) };
}

// ---------- test cases ------------------------------------------------------

describe("POST /invite/[token]/bump — happy path", () => {
  it("returns 200 { ok: true } and writes back a bumped cookie via Set-Cookie header", async () => {
    const cookie = makeCookie({ screenCount: 1 });
    mockCookiesGet.mockReturnValue({ value: cookie });
    mockInvitationFindUnique.mockResolvedValue({
      consumedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const res = await POST(makeRequest(VALID_TOKEN), makeParams(VALID_TOKEN));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // The Route Handler writes the bumped cookie via res.cookies.set()
    // which sets a Set-Cookie response header.
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).not.toBeNull();
    expect(setCookieHeader).toContain(GUEST_COOKIE_NAME);
    // The new value must differ from the original (it has screenCount = 2).
    expect(setCookieHeader).not.toContain(cookie.split(".")[0]); // payload differs
  });

  it("calls recordGuestInvitationView when screenCount is 1 (first view)", async () => {
    const cookie = makeCookie({ screenCount: 1 });
    mockCookiesGet.mockReturnValue({ value: cookie });
    mockInvitationFindUnique.mockResolvedValue({
      consumedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await POST(makeRequest(VALID_TOKEN), makeParams(VALID_TOKEN));

    expect(mockRecordView).toHaveBeenCalledOnce();
    expect(mockRecordView).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it("skips recordGuestInvitationView when screenCount > 1 (idempotency)", async () => {
    const cookie = makeCookie({ screenCount: 3 });
    mockCookiesGet.mockReturnValue({ value: cookie });
    mockInvitationFindUnique.mockResolvedValue({
      consumedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await POST(makeRequest(VALID_TOKEN), makeParams(VALID_TOKEN));

    expect(mockRecordView).not.toHaveBeenCalled();
  });
});

describe("POST /invite/[token]/bump — error paths", () => {
  it("returns 401 when no cookie is present", async () => {
    mockCookiesGet.mockReturnValue(undefined);

    const res = await POST(makeRequest(VALID_TOKEN), makeParams(VALID_TOKEN));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns 401 when cookie token does not match URL token", async () => {
    const cookie = makeCookie({ token: "c".repeat(64) }); // different token
    mockCookiesGet.mockReturnValue({ value: cookie });

    const res = await POST(makeRequest(VALID_TOKEN), makeParams(VALID_TOKEN));

    expect(res.status).toBe(401);
  });

  it("returns 410 when the invitation has been consumed", async () => {
    const cookie = makeCookie({ screenCount: 1 });
    mockCookiesGet.mockReturnValue({ value: cookie });
    mockInvitationFindUnique.mockResolvedValue({
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const res = await POST(makeRequest(VALID_TOKEN), makeParams(VALID_TOKEN));

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
