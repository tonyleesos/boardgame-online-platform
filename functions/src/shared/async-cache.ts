/** Bounded process-local cache. Coalesces concurrent misses and never caches failures. */
export function createAsyncCache<T>(
  ttlMs = 60_000,
  maxEntries = 8,
  now = Date.now,
) {
  const entries = new Map<string, { promise: Promise<T>; expiresAt: number }>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const existing = entries.get(key);
      if (existing && existing.expiresAt > now()) return existing.promise;
      const entry = {
        promise: Promise.resolve().then(load),
        expiresAt: Infinity,
      };
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > maxEntries)
        entries.delete(entries.keys().next().value!);
      entry.promise = entry.promise.then(
        (value) => {
          entry.expiresAt = now() + ttlMs;
          return value;
        },
        (error: unknown) => {
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        },
      );
      return entry.promise;
    },
    clear() {
      entries.clear();
    },
    delete(key: string) {
      entries.delete(key);
    },
  };
}
