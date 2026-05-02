import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Phase 3 L3 wave 1 — pin the publish layer's degradation contract.
 *
 * The two behaviours we MUST guarantee:
 *
 *   1. **No-op when admin client is null.** Local dev / preview without
 *      `SUPABASE_SERVICE_ROLE_KEY` returns null from createAdminClient;
 *      publishRealtimeEvent must NOT throw and NOT touch the
 *      Supabase channel API. If it ever did either, every server
 *      action that calls it would 500 in those environments.
 *   2. **Best-effort send: errors swallowed, never propagate.** The
 *      caller (a server action) treats publish as fire-and-forget;
 *      any throw here would bubble up as a failed save, which would
 *      defeat the purpose of "broadcast is the fast lane, CDC is the
 *      safety net."
 *
 * Implementation: the test mocks the admin client surface enough to
 * exercise the success path AND the throwing-channel-send path. We
 * don't need to involve a real Supabase server.
 */

const createAdminClientMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: (q: unknown) => findUniqueMock(q) },
  },
}));

beforeEach(() => {
  createAdminClientMock.mockReset();
  findUniqueMock.mockReset();
});

describe("publishRealtimeEvent — admin client null path", () => {
  it("returns silently and does NOT throw when SUPABASE_SERVICE_ROLE_KEY is unset", async () => {
    createAdminClientMock.mockReturnValue(null);
    const { publishRealtimeEvent } = await import("@/lib/realtime/publish");

    await expect(
      publishRealtimeEvent("p1", {
        kind: "rating_saved",
        actor: { userId: "u1", name: "オーナー" },
        venueId: "v1",
        dimensionCount: 1,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("publishRealtimeEvent — admin client present", () => {
  it("subscribes + sends + removes the channel on the success path", async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const subscribeMock = vi.fn();
    const removeChannelMock = vi.fn().mockResolvedValue(undefined);
    const channelMock = vi.fn(() => ({
      subscribe: subscribeMock,
      send: sendMock,
    }));

    createAdminClientMock.mockReturnValue({
      channel: channelMock,
      removeChannel: removeChannelMock,
    });

    const { publishRealtimeEvent } = await import("@/lib/realtime/publish");
    await publishRealtimeEvent("p1", {
      kind: "rating_saved",
      actor: { userId: "u1", name: "オーナー" },
      venueId: "v1",
      dimensionCount: 2,
    });

    expect(channelMock).toHaveBeenCalledWith(
      "project:p1",
      expect.objectContaining({
        config: expect.objectContaining({
          broadcast: expect.objectContaining({ self: false }),
        }),
      }),
    );
    expect(subscribeMock).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith({
      type: "broadcast",
      event: "haretoki:event",
      payload: expect.objectContaining({ kind: "rating_saved" }),
    });
    expect(removeChannelMock).toHaveBeenCalled();
  });

  it("does NOT throw when channel.send rejects (best-effort contract)", async () => {
    const sendMock = vi.fn().mockRejectedValue(new Error("socket dead"));
    const channelMock = vi.fn(() => ({
      subscribe: vi.fn(),
      send: sendMock,
    }));
    const removeChannelMock = vi.fn().mockResolvedValue(undefined);

    createAdminClientMock.mockReturnValue({
      channel: channelMock,
      removeChannel: removeChannelMock,
    });

    const { publishRealtimeEvent } = await import("@/lib/realtime/publish");
    await expect(
      publishRealtimeEvent("p1", {
        kind: "decision_made",
        actor: { userId: "u1", name: "オーナー" },
        venueId: "v1",
      }),
    ).resolves.toBeUndefined();

    // Cleanup still runs in finally
    expect(removeChannelMock).toHaveBeenCalled();
  });
});

describe("resolveActor", () => {
  it("uses User.name when present", async () => {
    findUniqueMock.mockResolvedValue({ name: "  オーナー  ", email: "o@example" });
    const { resolveActor } = await import("@/lib/realtime/publish");
    const actor = await resolveActor("u1");
    expect(actor).toEqual({ userId: "u1", name: "オーナー" });
  });

  it("falls back to email when name is null/empty", async () => {
    findUniqueMock.mockResolvedValue({ name: null, email: "o@example" });
    const { resolveActor } = await import("@/lib/realtime/publish");
    const actor = await resolveActor("u2");
    expect(actor.name).toBe("o@example");
  });

  it("falls back to メンバー when row missing", async () => {
    findUniqueMock.mockResolvedValue(null);
    const { resolveActor } = await import("@/lib/realtime/publish");
    const actor = await resolveActor("u3");
    expect(actor.name).toBe("メンバー");
  });
});
