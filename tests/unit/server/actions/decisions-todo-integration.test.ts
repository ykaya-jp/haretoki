import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * F3 — makeDecision の todo 連携契約。
 *
 * 目的:
 *   - 同一 venue 再決定 → reset しない（todo 完了状態を保つ）
 *   - 別 venue 再決定 → reset する（別 venue の完了が継承されないため）
 *   - seed は常に呼ばれる（冪等なので副作用なし）
 *   - cancelDecision は lastCancelledVenueId を保存し、次回 make で比較材料になる
 */

const decisionFindUnique = vi.fn();
const projectFindUnique = vi.fn();
const projectUpdate = vi.fn();
const venueUpdate = vi.fn();
const decisionUpsert = vi.fn();
const decisionDelete = vi.fn();

const transactionMock = vi.fn(
  async (arg: unknown) => {
    if (typeof arg === "function") {
      // callback form
      return await (
        arg as (tx: unknown) => Promise<unknown>
      )({
        venue: { update: venueUpdate },
        project: { update: projectUpdate },
        decision: { upsert: decisionUpsert, delete: decisionDelete },
      });
    }
    // array form: run each promise and return the results
    return await Promise.all(arg as unknown[]);
  },
);

const seedSpy = vi.fn(async (_projectId: string) => ({ seeded: 15 }));
const resetSpy = vi.fn(async (_projectId: string) => ({ reset: 0 }));

vi.mock("@/server/db", () => ({
  prisma: {
    decision: {
      findUnique: (...args: unknown[]) => decisionFindUnique(...args),
      delete: (...args: unknown[]) => decisionDelete(...args),
    },
    project: {
      findUnique: (...args: unknown[]) => projectFindUnique(...args),
      update: (...args: unknown[]) => projectUpdate(...args),
    },
    venue: { update: (...args: unknown[]) => venueUpdate(...args) },
    $transaction: (arg: unknown) => transactionMock(arg),
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({
    projectId: "proj-1",
    role: "owner",
  })),
  requireVenueAccess: vi.fn(async () => ({
    projectId: "proj-1",
    venue: { id: "venue-new", projectId: "proj-1" },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
}));

vi.mock("@/lib/decision-todos/seed", () => ({
  seedSystemTodos: (projectId: string) => seedSpy(projectId),
  resetSystemTodosCompletion: (projectId: string) => resetSpy(projectId),
}));

// Phase 3 L3 wave 1 — makeDecision now calls publishRealtimeEvent +
// resolveActor. Both are best-effort and out of scope for this
// integration test, so we stub them to keep the suite focused on
// venue/todo-reset logic.
vi.mock("@/lib/realtime/publish", () => ({
  publishRealtimeEvent: vi.fn().mockResolvedValue(undefined),
  resolveActor: vi.fn().mockResolvedValue({ userId: "user-1", name: "Owner" }),
}));

beforeEach(() => {
  decisionFindUnique.mockReset();
  projectFindUnique.mockReset();
  projectUpdate.mockReset();
  venueUpdate.mockReset();
  decisionUpsert.mockReset();
  decisionDelete.mockReset();
  transactionMock.mockClear();
  seedSpy.mockClear();
  resetSpy.mockClear();
  // Default: transaction passes through
  decisionUpsert.mockResolvedValue({
    id: "decision-1",
    projectId: "proj-1",
    selectedVenueId: "venue-new",
  });
});

describe("makeDecision — venue 変更時の todo reset", () => {
  it("resets todos when prior decision had a different venueId (direct re-decide)", async () => {
    decisionFindUnique.mockResolvedValue({ selectedVenueId: "venue-old" });
    projectFindUnique.mockResolvedValue({ lastCancelledVenueId: null });

    const { makeDecision } = await import("@/server/actions/decisions");
    await makeDecision({
      selectedVenueId: "99999999-9999-4999-8999-999999999999",
    });

    expect(resetSpy).toHaveBeenCalledWith("proj-1");
    expect(seedSpy).toHaveBeenCalledWith("proj-1");
  });

  it("does NOT reset when prior decision had the same venueId (idempotent re-confirm)", async () => {
    const sameId = "88888888-8888-8888-8888-888888888888";
    decisionFindUnique.mockResolvedValue({ selectedVenueId: sameId });
    projectFindUnique.mockResolvedValue({ lastCancelledVenueId: null });

    // Override requireVenueAccess to return the same venue.
    const { makeDecision } = await import("@/server/actions/decisions");
    // Override requireVenueAccess already set in global mock; sameId is validated
    // as a valid UUID so makeDecision proceeds past the zod guard.
    await makeDecision({ selectedVenueId: sameId });

    // prior === new → venueChanged false → no reset
    expect(resetSpy).not.toHaveBeenCalled();
    expect(seedSpy).toHaveBeenCalledWith("proj-1");
  });

  it("resets when cancel→make sequence picks a different venueId", async () => {
    decisionFindUnique.mockResolvedValue(null);
    projectFindUnique.mockResolvedValue({
      lastCancelledVenueId: "venue-cancelled",
    });

    const { makeDecision } = await import("@/server/actions/decisions");
    await makeDecision({
      selectedVenueId: "77777777-7777-4777-a777-777777777777",
    });

    expect(resetSpy).toHaveBeenCalledWith("proj-1");
  });

  it("does NOT reset when cancel→make sequence picks the same venueId back", async () => {
    const sameId = "66666666-6666-4666-8666-666666666666";
    decisionFindUnique.mockResolvedValue(null);
    projectFindUnique.mockResolvedValue({ lastCancelledVenueId: sameId });

    const { makeDecision } = await import("@/server/actions/decisions");
    await makeDecision({ selectedVenueId: sameId });

    expect(resetSpy).not.toHaveBeenCalled();
    expect(seedSpy).toHaveBeenCalledWith("proj-1");
  });

  it("does NOT reset on first-ever decision (no prior, no cancellation marker)", async () => {
    decisionFindUnique.mockResolvedValue(null);
    projectFindUnique.mockResolvedValue({ lastCancelledVenueId: null });

    const { makeDecision } = await import("@/server/actions/decisions");
    await makeDecision({
      selectedVenueId: "55555555-5555-4555-9555-555555555555",
    });

    expect(resetSpy).not.toHaveBeenCalled();
    expect(seedSpy).toHaveBeenCalledWith("proj-1");
  });

  it("seed failure does not break the decision (captured via sentry, action returns success)", async () => {
    decisionFindUnique.mockResolvedValue(null);
    projectFindUnique.mockResolvedValue({ lastCancelledVenueId: null });
    seedSpy.mockRejectedValueOnce(new Error("seed boom"));

    const { makeDecision } = await import("@/server/actions/decisions");
    const res = await makeDecision({
      selectedVenueId: "44444444-4444-4444-8444-444444444444",
    });

    expect("decision" in res).toBe(true);
  });
});
