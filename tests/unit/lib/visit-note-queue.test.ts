import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueueVisitNote,
  peekQueue,
  removeFromQueue,
  clearQueue,
} from "@/lib/visit-note-queue";

const QUEUE_KEY = "haretoki:visit-note-queue:v1";

describe("visit-note-queue", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty queue when nothing is stored yet", () => {
    expect(peekQueue()).toEqual([]);
  });

  it("enqueues a note and reads it back with payload + visitId intact", () => {
    const entry = enqueueVisitNote("visit-1", {
      content: "気持ちの良い天井高さ",
      locationLat: 35.6,
      locationLng: 139.7,
    });
    const all = peekQueue();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(entry.id);
    expect(all[0]?.visitId).toBe("visit-1");
    expect(all[0]?.payload.content).toBe("気持ちの良い天井高さ");
    expect(all[0]?.payload.locationLat).toBe(35.6);
    // queuedAt is an ISO string and should be parseable.
    expect(Number.isNaN(Date.parse(all[0]?.queuedAt ?? ""))).toBe(false);
  });

  it("preserves enqueue order for multiple notes", () => {
    const a = enqueueVisitNote("v-1", { content: "a" });
    const b = enqueueVisitNote("v-1", { content: "b" });
    const c = enqueueVisitNote("v-2", { content: "c" });
    expect(peekQueue().map((e) => e.id)).toEqual([a.id, b.id, c.id]);
  });

  it("removes a single entry by id without disturbing the others", () => {
    const a = enqueueVisitNote("v-1", { content: "keep" });
    const b = enqueueVisitNote("v-1", { content: "drop" });
    const c = enqueueVisitNote("v-2", { content: "keep too" });
    removeFromQueue(b.id);
    const remaining = peekQueue();
    expect(remaining.map((e) => e.id)).toEqual([a.id, c.id]);
  });

  it("ignores removeFromQueue for a non-existent id (no-op)", () => {
    enqueueVisitNote("v-1", { content: "stays" });
    removeFromQueue("not-in-queue");
    expect(peekQueue()).toHaveLength(1);
  });

  it("clearQueue empties everything", () => {
    enqueueVisitNote("v-1", { content: "a" });
    enqueueVisitNote("v-2", { content: "b" });
    clearQueue();
    expect(peekQueue()).toEqual([]);
  });

  it("recovers from corrupted localStorage by treating it as empty", () => {
    window.localStorage.setItem(QUEUE_KEY, "not-valid-json{");
    expect(peekQueue()).toEqual([]);
  });

  it("ignores a non-array stored value", () => {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify({ foo: "bar" }));
    expect(peekQueue()).toEqual([]);
  });

  it("each enqueue produces a unique id", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(enqueueVisitNote("v-1", { content: `n${i}` }).id);
    }
    expect(ids.size).toBe(20);
  });
});
