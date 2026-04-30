/**
 * Tiny debounce utility for the venue-name search input.
 *
 * Kept as a standalone module (not an inline hook) so unit tests can
 * use vitest fake timers without spinning up React. We deliberately
 * don't reach for `use-debounce` or similar — 15 lines of code vs a
 * bundled dependency for one caller.
 *
 * Contract:
 *   - calling `fn(args)` schedules the callback after `delayMs`
 *   - subsequent calls within the window reset the timer to a new args
 *   - `cancel()` clears any pending invocation (used on unmount / Sheet close)
 *   - `flush()` runs the pending invocation immediately with the last args
 */
export interface DebouncedFn<Args extends unknown[]> {
  (...args: Args): void;
  cancel: () => void;
  flush: () => void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): DebouncedFn<Args> {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  const debounced = ((...args: Args) => {
    pendingArgs = args;
    if (handle !== null) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      if (pendingArgs) {
        const a = pendingArgs;
        pendingArgs = null;
        fn(...a);
      }
    }, delayMs);
  }) as DebouncedFn<Args>;

  debounced.cancel = () => {
    if (handle !== null) clearTimeout(handle);
    handle = null;
    pendingArgs = null;
  };

  debounced.flush = () => {
    if (handle !== null) {
      clearTimeout(handle);
      handle = null;
    }
    if (pendingArgs) {
      const a = pendingArgs;
      pendingArgs = null;
      fn(...a);
    }
  };

  return debounced;
}
