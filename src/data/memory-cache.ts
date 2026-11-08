/** Session-memory only. Loaders must validate before resolving. */
export interface LoadOptions { forceRefresh?: boolean }

export function createMemoryCache<T>(loader: () => Promise<T>, ttlMs = 60_000) {
  let generation = 0;
  let cached: { value: T; expires: number } | undefined;
  let pending: Promise<T> | undefined;
  function invalidate() {
    generation++;
    cached = undefined;
    pending = undefined;
  }
  async function get(options: LoadOptions = {}): Promise<T> {
    if (options.forceRefresh) invalidate();
    if (cached && Date.now() < cached.expires) return structuredClone(cached.value);
    if (!pending) {
      const current = generation;
      const request = Promise.resolve().then(loader).then(value => {
        const owned = structuredClone(value);
        if (generation === current) cached = { value: owned, expires: Date.now() + ttlMs };
        return owned;
      });
      pending = request;
      void request.finally(() => {
        if (pending === request) pending = undefined;
      }).catch(() => {});
    }
    return structuredClone(await pending);
  }
  return { get, invalidate };
}
