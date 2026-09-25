/**
 * Memoize an async schema/bootstrap function so its DDL runs once per process
 * instead of on every API call. Keyed by name so callers can pass the same
 * key from different wrappers.
 *
 * If the run fails, the memo is cleared so the next call retries.
 */
const inflight = new Map<string, Promise<unknown>>();

export function ensureOnce<T>(key: string, run: () => Promise<T>): Promise<T> {
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = run().catch((err) => {
      inflight.delete(key);
      throw err;
    });
    inflight.set(key, p);
  }
  return p;
}
