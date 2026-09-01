// Tiny module-level TTL cache for near-static reference data (games, payment
// methods, categories). getDocs bypasses the SDK's persistent cache and always
// hits the network; caching this data in memory avoids re-fetching on every
// modal open / page mount. Reference data is admin-managed, so a short TTL is
// safe. For user-scoped / live data use real-time listeners instead.

type CachedQuery<T> = { timestamp: number; promise: Promise<T> };

const cache = new Map<string, CachedQuery<unknown>>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function withStaticCache<T>(key: string, loader: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.timestamp < ttlMs) {
    return hit.promise as Promise<T>;
  }
  const promise = loader().catch((err) => {
    // Drop failed entries so a transient network error is retried on next call.
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw err;
  });
  cache.set(key, { timestamp: Date.now(), promise });
  return promise;
}

export function invalidateStaticCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
