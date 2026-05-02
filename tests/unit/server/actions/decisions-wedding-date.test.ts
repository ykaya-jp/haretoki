import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Track C-2 server-action coverage for `updateWeddingDate`.
 *
 * Pinned contracts:
 *   - rejects malformed strings BEFORE auth + DB
 *   - rejects calendar-impossible dates (Feb 31 etc.)
 *   - accepts null to clear
 *   - persists JST midnight (matching the pure-helper convention)
 *   - returns user-safe error when no Decision exists yet (defence in
 *     depth — the UI gates this behind hasDecision but we don't trust
 *     the client)
 *   - DB failure → captured + user-safe error, no throw
 */

const mockUpdateMany = vi.fn();
const mockRequireUser = vi.fn();
const mockRequireProjectMembership = vi.fn();
const mockCaptureError = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    decision: {
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  requireProjectMembership: (...a: unknown[]) => mockRequireProjectMembership(...a),
  requireVenueAccess: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: (...a: unknown[]) => mockCaptureError(...a),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
  revalidateTag: (...a: unknown[]) => mockRevalidateTag(...a),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerEvent: vi.fn(),
}));

vi.mock("@/lib/decision-todos/seed", () => ({
  seedSystemTodos: vi.fn(),
  resetSystemTodosCompletion: vi.fn(),
}));

// Phase 3 L3 wave 1 — updateWeddingDate / makeDecision now call
// publishRealtimeEvent + resolveActor. Both are best-effort and out of
// scope for this test suite, so we stub them so the existing
// `prisma.user.findUnique` mock isn't required and the test stays
// focused on the decision-side behaviour.
vi.mock("@/lib/realtime/publish", () => ({
  publishRealtimeEvent: vi.fn().mockResolvedValue(undefined),
  resolveActor: vi.fn().mockResolvedValue({ userId: "user-1", name: "Owner" }),
}));

import { updateWeddingDate } from "@/server/actions/decisions";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1" });
  mockRequireProjectMembership.mockResolvedValue({ projectId: "proj-1" });
});

describe("updateWeddingDate — validation", () => {
  it("rejects non-YYYY-MM-DD strings BEFORE touching auth + DB", async () => {
    const result = await updateWeddingDate({ date: "2026/05/16" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/形式|日付/);
    expect(mockRequireUser).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects an ISO timestamp (only date-only allowed)", async () => {
    const result = await updateWeddingDate({ date: "2026-05-16T12:00:00Z" });
    expect(result.ok).toBe(false);
    expect(mockRequireUser).not.toHaveBeenCalled();
  });

  it("rejects calendar-impossible dates AFTER zod regex but BEFORE auth", async () => {
    // Feb 31 passes the regex but fails parseWeddingDateInput's
    // round-trip guard. Critical — JS Date silently bumps Feb 31 →
    // March 3 without the guard.
    const result = await updateWeddingDate({ date: "2026-02-31" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/存在しない/);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

describe("updateWeddingDate — persistence", () => {
  it("persists JST midnight as the stored DateTime", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await updateWeddingDate({ date: "2026-05-16" });

    expect(result).toEqual({ ok: true });
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const args = mockUpdateMany.mock.calls[0][0];
    expect(args.where).toEqual({ projectId: "proj-1" });
    // JST midnight 2026-05-16 = UTC 15:00 2026-05-15
    const expected = new Date(Date.UTC(2026, 4, 15, 15, 0, 0));
    expect(args.data.weddingDate).toBeInstanceOf(Date);
    expect((args.data.weddingDate as Date).getTime()).toBe(expected.getTime());
  });

  it("revalidates /home and /journey on success so the countdown re-renders", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    await updateWeddingDate({ date: "2026-05-16" });

    expect(mockRevalidateTag).toHaveBeenCalledWith("project:proj-1", { expire: 0 });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/home");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/journey");
  });

  it("accepts null to clear the wedding date", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await updateWeddingDate({ date: null });

    expect(result).toEqual({ ok: true });
    expect(mockUpdateMany.mock.calls[0][0].data).toEqual({ weddingDate: null });
  });
});

describe("updateWeddingDate — guards", () => {
  it("returns user-safe error when no Decision exists (defence in depth)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const result = await updateWeddingDate({ date: "2026-05-16" });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/まだ式場が決まっていません/);
    // No revalidate when nothing changed.
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("captures DB failure and returns a user-safe error (no throw)", async () => {
    mockUpdateMany.mockRejectedValue(new Error("connection lost"));

    const result = await updateWeddingDate({ date: "2026-05-16" });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/失敗/);
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
  });
});
