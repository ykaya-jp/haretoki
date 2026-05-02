/**
 * Phase 3 Level 3 wave 3 — generic offline queue + LWW reconcile.
 *
 * Generalises the W20-1 visit-note-queue pattern so any
 * "client edits a record while offline → flush when back online →
 * reconcile against whatever the server already has" flow can use
 * one consistent primitive instead of each form re-implementing
 * localStorage glue.
 *
 * Design choices (carried over from visit-note-queue.ts):
 *   - localStorage, not IndexedDB. Payloads are O(few KB) and the
 *     access pattern is "list / push / remove". IndexedDB adds
 *     async boilerplate without buying anything in this size class.
 *   - Per-namespace versioned key (`haretoki:sync:<namespace>:v1`).
 *     A future schema migration can ignore stale entries instead
 *     of crashing on shape drift.
 *   - All reads degrade to "empty queue" on corrupt JSON, disabled
 *     storage, or SSR. The queue is best-effort; never throws.
 *
 * What is intentionally NOT here (scoped to a follow-up round):
 *   - The version-based optimistic lock from
 *     `docs/phase3/partner-level-3-design.md` Wave 3.3 needs a
 *     `VisitNote.version` schema column + WHERE-version UPDATE on
 *     the server. That is a database change and is deferred to a
 *     dedicated round (see `docs/phase3/partner-level-3-design.md`
 *     for the deferral rationale).
 *   - Realtime presence ("partner is editing right now") needs
 *     Supabase Realtime presence channel; that ships separately
 *     under wave 3.1 (worker A's track).
 */

const KEY_PREFIX = "haretoki:sync";
const KEY_VERSION = "v1";

/**
 * A single queued mutation. Payload type is generic so a rating
 * queue, a note queue, and a checklist-answer queue can share the
 * same storage primitives without sharing a payload schema.
 *
 * `targetKey` is the canonical "what does this edit?" identifier —
 * for ratings this would be `${visitId}:${dimension}` so a couple
 * who edits the same dimension twice while offline only gets the
 * latest entry replayed (we deduplicate by targetKey on enqueue).
 *
 * `clientWrittenAt` is when the user pressed save in the local
 * client — used by the LWW guard to decide whether a Realtime
 * event from the server should overwrite an in-flight queued
 * payload, or whether the queued payload is newer and should win.
 */
export interface QueuedMutation<P> {
  /** Local UUID; distinct from any DB id. Used to address the
   *  entry for retry / removal. */
  id: string;
  /** "What does this mutation edit?" — used by enqueue to dedupe
   *  multiple offline writes to the same target. */
  targetKey: string;
  /** Domain-specific payload — never inspected by the queue. */
  payload: P;
  /** ISO 8601 of the local save action. Drives the LWW comparison
   *  in `shouldAcceptServerUpdate`. */
  clientWrittenAt: string;
}

/**
 * Internal storage shape. Versioned so a v2 migration can leave
 * v1 rows untouched (the queue would just appear empty under v2).
 * Exported for tests; production callers go through the helpers
 * below.
 */
export interface SyncStore<P> {
  version: typeof KEY_VERSION;
  entries: QueuedMutation<P>[];
}

function storageKey(namespace: string): string {
  // Namespace is part of the key, not part of the value, so
  // independent queues (ratings vs notes) don't share JSON-decode
  // failure modes — a corrupt note queue won't blank the rating
  // queue.
  return `${KEY_PREFIX}:${namespace}:${KEY_VERSION}`;
}

function readQueue<P>(namespace: string): QueuedMutation<P>[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(namespace));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Accept either the wrapped { version, entries } shape (used by
    // newly-written queues) or a bare array (carried forward from
    // visit-note-queue.ts so existing browsers that have already
    // persisted a `[…]` payload don't drop their unsent rows on the
    // first paint after this lands).
    if (Array.isArray(parsed)) {
      return parsed as QueuedMutation<P>[];
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { entries?: unknown }).entries)
    ) {
      return (parsed as { entries: QueuedMutation<P>[] }).entries;
    }
    return [];
  } catch {
    return [];
  }
}

function writeQueue<P>(
  namespace: string,
  entries: QueuedMutation<P>[],
): void {
  if (typeof window === "undefined") return;
  try {
    const store: SyncStore<P> = { version: KEY_VERSION, entries };
    window.localStorage.setItem(storageKey(namespace), JSON.stringify(store));
  } catch {
    // localStorage full / disabled (Safari private mode etc.).
    // Drop silently — the caller's component state still holds the
    // unsent payload until the user dismisses, and the next save
    // attempt will retry against the live server.
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Append a failed mutation to the queue. Existing entries with the
 * same `targetKey` are dropped — only the latest queued payload for
 * a given target is replayed. This matches what couples actually
 * mean when they edit the same dimension twice offline: the second
 * write supersedes the first.
 */
export function enqueueMutation<P>(
  namespace: string,
  targetKey: string,
  payload: P,
): QueuedMutation<P> {
  const entry: QueuedMutation<P> = {
    id: uuid(),
    targetKey,
    payload,
    clientWrittenAt: new Date().toISOString(),
  };
  const existing = readQueue<P>(namespace).filter(
    (e) => e.targetKey !== targetKey,
  );
  existing.push(entry);
  writeQueue(namespace, existing);
  return entry;
}

/** Snapshot of every queued entry. Order = enqueue order
 *  (oldest first). */
export function peekQueue<P>(namespace: string): QueuedMutation<P>[] {
  return readQueue<P>(namespace);
}

/** Remove a single entry by its local id. No-op when not found. */
export function removeFromQueue(namespace: string, id: string): void {
  const next = readQueue(namespace).filter((e) => e.id !== id);
  writeQueue(namespace, next);
}

/** Drop the entire queue. Used by tests and by
 *  "user explicitly discards drafts" UX paths. */
export function clearQueue(namespace: string): void {
  writeQueue(namespace, []);
}

/**
 * Last-Write-Wins reconcile guard.
 *
 * Returns `true` when the client should accept a server-side update
 * (typically delivered via a Realtime event), `false` when the
 * client has a more recent unsent edit queued and the server's
 * version is stale relative to it.
 *
 * Rules:
 *   - No queued entry for the target → always accept (server wins
 *     by default; nothing to lose).
 *   - Queued entry exists AND `clientWrittenAt > serverUpdatedAt`
 *     → reject. The queued payload will overwrite this server row
 *     when it flushes, so showing the server snapshot now would
 *     flicker the UI back to a stale value.
 *   - Queued entry exists AND `clientWrittenAt <= serverUpdatedAt`
 *     → accept. The server has independently moved past our queued
 *     write (probably because the partner edited the same target
 *     after we went offline); our queued write should also be
 *     considered stale and dropped on next flush. The caller is
 *     responsible for that drop — see `dropStaleQueuedEntries`.
 *
 * "Equal" timestamps fall into "accept" because the server's clock
 * is the canonical source; ties are unlikely outside of test
 * fixtures, and biasing toward server reduces the rare case where
 * we keep showing a stale local copy.
 */
export function shouldAcceptServerUpdate<P>(
  namespace: string,
  targetKey: string,
  serverUpdatedAt: string | Date,
): boolean {
  const queued = readQueue<P>(namespace).find(
    (e) => e.targetKey === targetKey,
  );
  if (!queued) return true;
  const serverIso =
    typeof serverUpdatedAt === "string"
      ? serverUpdatedAt
      : serverUpdatedAt.toISOString();
  return queued.clientWrittenAt <= serverIso;
}

/**
 * After accepting a server update for a target whose queued entry
 * lost the LWW comparison, drop the now-stale queued entry so a
 * later flush doesn't re-overwrite the server with a payload the
 * couple already saw on screen replaced.
 *
 * Returns the number of entries dropped (0 or 1 — there is at most
 * one queued entry per targetKey by `enqueueMutation`'s dedupe).
 */
export function dropStaleQueuedEntries(
  namespace: string,
  targetKey: string,
): number {
  const before = readQueue(namespace);
  const after = before.filter((e) => e.targetKey !== targetKey);
  if (after.length === before.length) return 0;
  writeQueue(namespace, after);
  return before.length - after.length;
}

/** Convenience: how many entries are currently queued in a namespace.
 *  UI uses this to render "保存待機中: N 件" without serialising the
 *  whole array. */
export function queueLength(namespace: string): number {
  return readQueue(namespace).length;
}
