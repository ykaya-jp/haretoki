/**
 * Run async tasks with a bounded concurrency limit. Preserves input order.
 *
 * Extracted from venues.ts so review batch import can share the same
 * implementation without duplicating the worker-pool pattern. Inline
 * implementation — `p-limit` isn't a dependency.
 */
export async function limitedAll<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array(workerCount)
    .fill(0)
    .map(async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        results[idx] = await fn(items[idx], idx);
      }
    });
  await Promise.all(workers);
  return results;
}
