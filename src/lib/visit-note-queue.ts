/**
 * W20-1: localStorage-backed queue for visit notes that failed to reach the
 * server. Couples write notes on the venue floor where reception is often
 * patchy — a single dropped Server Action used to silently lose the memo
 * (toast.error and gone). This module persists the unsent payload locally
 * so it can be retried by hand or auto-flushed when the browser reports
 * back online.
 *
 * Design notes:
 *  - localStorage, not IndexedDB. The payloads are small (text + 2 numbers
 *    + optional tags) and the access pattern is "list / push / remove",
 *    which a JSON-encoded array handles fine. IndexedDB would add async
 *    boilerplate without buying anything in this size class.
 *  - Versioned key (`...:v1`) so a future schema migration can ignore old
 *    entries instead of crashing on shape drift.
 *  - All reads are defensive — corrupt JSON, disabled storage, or missing
 *    `window` (SSR) all degrade to "empty queue", never throw. The queue
 *    is a best-effort safety net, not a transactional store.
 *  - Photos are intentionally NOT queued here. They live behind Supabase
 *    Storage uploads and need their own offline strategy (W20-2).
 */

const QUEUE_KEY = "haretoki:visit-note-queue:v1";

export interface QueuedVisitNotePayload {
  content: string;
  /** Tier-2 vibe tags attached to the note. */
  tags?: string[];
  locationLat?: number;
  locationLng?: number;
}

export interface QueuedVisitNote {
  /** Local UUID — distinct from the eventual DB id (the row doesn't
   *  exist yet). Used to address an entry for retry / removal. */
  id: string;
  visitId: string;
  payload: QueuedVisitNotePayload;
  /** ISO 8601 — useful when the UI wants to show "10 分前に下書きとして残しました". */
  queuedAt: string;
}

function readQueue(): QueuedVisitNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedVisitNote[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedVisitNote[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full / disabled (private mode on some browsers).
    // Drop silently — the note is still in component state until the
    // user dismisses the toast, and the next attempt will retry.
  }
}

/** Append a failed note to the queue and return the persisted entry. */
export function enqueueVisitNote(
  visitId: string,
  payload: QueuedVisitNotePayload,
): QueuedVisitNote {
  const entry: QueuedVisitNote = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    visitId,
    payload,
    queuedAt: new Date().toISOString(),
  };
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  return entry;
}

/** Snapshot of every queued note. Order = enqueue order (oldest first). */
export function peekQueue(): QueuedVisitNote[] {
  return readQueue();
}

/** Remove a single entry by its local id. No-op when not found. */
export function removeFromQueue(id: string): void {
  const next = readQueue().filter((e) => e.id !== id);
  writeQueue(next);
}

/** Drop the entire queue. Used by tests; the live UI removes per-id. */
export function clearQueue(): void {
  writeQueue([]);
}
