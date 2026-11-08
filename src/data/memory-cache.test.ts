import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryCache } from './memory-cache';

afterEach(() => vi.useRealTimers());
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
it('deduplicates in-flight reads, clones each caller and expires at 60 seconds', async () => {
  vi.useFakeTimers();
  const original = { nested: { text: 'safe' } };
  const loader = vi.fn(async () => original);
  const cache = createMemoryCache(loader);
  const [a, b] = await Promise.all([cache.get(), cache.get()]);
  a.nested.text = 'changed';
  original.nested.text = 'external';
  expect(b.nested.text).toBe('safe');
  expect((await cache.get()).nested.text).toBe('safe');
  vi.advanceTimersByTime(59_999);
  await cache.get();
  expect(loader).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  await cache.get();
  expect(loader).toHaveBeenCalledTimes(2);
});
it('never caches loader or validation errors', async () => {
  const loader = vi.fn().mockRejectedValueOnce(new Error('invalid')).mockResolvedValue({ ok: true });
  const cache = createMemoryCache(loader);
  await expect(cache.get()).rejects.toThrow('invalid');
  await expect(cache.get()).resolves.toEqual({ ok: true });
  expect(loader).toHaveBeenCalledTimes(2);
});
it('invalidates completed reads and forces a new read', async () => {
  const loader = vi.fn(async () => ({ count: loader.mock.calls.length }));
  const cache = createMemoryCache(loader);
  await cache.get();
  cache.invalidate();
  expect(await cache.get()).toEqual({ count: 2 });
  expect(await cache.get({ forceRefresh: true })).toEqual({ count: 3 });
});
it('prevents stale in-flight writes after invalidation and preserves newer pending request', async () => {
  const old = deferred<{ text: string }>();
  const fresh = deferred<{ text: string }>();
  const loader = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const cache = createMemoryCache(loader);
  const first = cache.get();
  await Promise.resolve();
  cache.invalidate();
  const second = cache.get();
  await Promise.resolve();
  old.resolve({ text: 'old' });
  await first;
  const third = cache.get();
  fresh.resolve({ text: 'fresh' });
  expect(await second).toEqual({ text: 'fresh' });
  expect(await third).toEqual({ text: 'fresh' });
  expect(await cache.get()).toEqual({ text: 'fresh' });
  expect(loader).toHaveBeenCalledTimes(2);
});
