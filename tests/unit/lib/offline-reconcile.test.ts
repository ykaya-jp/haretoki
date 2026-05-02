import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueueMutation,
  peekQueue,
  removeFromQueue,
  clearQueue,
  shouldAcceptServerUpdate,
  dropStaleQueuedEntries,
  queueLength,
} from "@/lib/sync/offline-reconcile";

// jsdom provides localStorage but does not isolate it between
// suites. Each test starts from an empty store so flake from order
// dependence is impossible.
beforeEach(() => {
  window.localStorage.clear();
});

describe("offline-reconcile", () => {
  describe("enqueueMutation", () => {
    it("returns the persisted entry with a generated id", () => {
      const entry = enqueueMutation<{ score: number }>(
        "rating",
        "visit1:cuisine",
        { score: 4 },
      );
      expect(entry.id).toBeTruthy();
      expect(entry.targetKey).toBe("visit1:cuisine");
      expect(entry.payload).toEqual({ score: 4 });
      expect(typeof entry.clientWrittenAt).toBe("string");
    });

    it("dedupes by targetKey — the latest payload wins", () => {
      enqueueMutation<{ score: number }>("rating", "visit1:cuisine", {
        score: 3,
      });
      enqueueMutation<{ score: number }>("rating", "visit1:cuisine", {
        score: 5,
      });
      const queue = peekQueue<{ score: number }>("rating");
      expect(queue).toHaveLength(1);
      expect(queue[0]?.payload.score).toBe(5);
    });

    it("keeps entries from different namespaces independent", () => {
      enqueueMutation("rating", "v1:cuisine", { score: 4 });
      enqueueMutation("note", "v1", { content: "memo" });
      expect(queueLength("rating")).toBe(1);
      expect(queueLength("note")).toBe(1);
    });
  });

  describe("peekQueue / removeFromQueue / clearQueue", () => {
    it("peeks oldest-first, removes by id, clears all", () => {
      const a = enqueueMutation("rating", "v1:cuisine", { score: 4 });
      enqueueMutation("rating", "v2:cuisine", { score: 5 });
      const queue = peekQueue("rating");
      expect(queue.map((e) => e.targetKey)).toEqual([
        "v1:cuisine",
        "v2:cuisine",
      ]);

      removeFromQueue("rating", a.id);
      expect(peekQueue("rating").map((e) => e.targetKey)).toEqual([
        "v2:cuisine",
      ]);

      clearQueue("rating");
      expect(peekQueue("rating")).toHaveLength(0);
    });
  });

  describe("shouldAcceptServerUpdate (LWW guard)", () => {
    it("accepts when no queued entry exists for the target", () => {
      expect(
        shouldAcceptServerUpdate(
          "rating",
          "v1:cuisine",
          new Date().toISOString(),
        ),
      ).toBe(true);
    });

    it("rejects when the queued payload is newer than server", () => {
      // Pin Date.now so the queued entry has a clientWrittenAt we
      // can compare against deterministically.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
      enqueueMutation("rating", "v1:cuisine", { score: 5 });
      vi.useRealTimers();

      // Server timestamp is older than the queued write.
      const olderServer = "2026-08-01T11:00:00Z";
      expect(
        shouldAcceptServerUpdate("rating", "v1:cuisine", olderServer),
      ).toBe(false);
    });

    it("accepts when the server has moved past the queued payload", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
      enqueueMutation("rating", "v1:cuisine", { score: 5 });
      vi.useRealTimers();

      const newerServer = "2026-08-01T13:00:00Z";
      expect(
        shouldAcceptServerUpdate("rating", "v1:cuisine", newerServer),
      ).toBe(true);
    });

    it("accepts on equal timestamps (server is canonical clock)", () => {
      vi.useFakeTimers();
      const t = new Date("2026-08-01T12:00:00Z");
      vi.setSystemTime(t);
      enqueueMutation("rating", "v1:cuisine", { score: 5 });
      vi.useRealTimers();

      expect(
        shouldAcceptServerUpdate("rating", "v1:cuisine", t.toISOString()),
      ).toBe(true);
    });
  });

  describe("dropStaleQueuedEntries", () => {
    it("removes the queued entry for a given target after the server wins LWW", () => {
      enqueueMutation("rating", "v1:cuisine", { score: 5 });
      enqueueMutation("rating", "v2:cuisine", { score: 4 });
      expect(dropStaleQueuedEntries("rating", "v1:cuisine")).toBe(1);
      const remaining = peekQueue("rating");
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.targetKey).toBe("v2:cuisine");
    });

    it("returns 0 when no entry matches", () => {
      enqueueMutation("rating", "v1:cuisine", { score: 5 });
      expect(dropStaleQueuedEntries("rating", "missing")).toBe(0);
      expect(peekQueue("rating")).toHaveLength(1);
    });
  });

  describe("legacy bare-array storage shape", () => {
    it("reads bare-array localStorage from the visit-note-queue era", () => {
      // Simulate a payload written by the W20-1 visit-note-queue
      // (which serialised QueuedVisitNote[] directly without the
      // { version, entries } wrapper).
      const legacy = [
        {
          id: "legacy-1",
          targetKey: "v1:cuisine",
          payload: { score: 3 },
          clientWrittenAt: "2026-08-01T10:00:00Z",
        },
      ];
      window.localStorage.setItem(
        "haretoki:sync:rating:v1",
        JSON.stringify(legacy),
      );
      const queue = peekQueue<{ score: number }>("rating");
      expect(queue).toHaveLength(1);
      expect(queue[0]?.payload.score).toBe(3);
    });
  });

  describe("queueLength", () => {
    it("returns 0 for empty / unknown namespaces", () => {
      expect(queueLength("rating")).toBe(0);
      expect(queueLength("never-used")).toBe(0);
    });

    it("counts non-deduped entries across distinct targets", () => {
      enqueueMutation("rating", "v1:cuisine", { score: 4 });
      enqueueMutation("rating", "v2:cuisine", { score: 5 });
      expect(queueLength("rating")).toBe(2);
    });
  });
});
