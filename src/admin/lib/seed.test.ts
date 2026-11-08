import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getDocs: vi.fn(), getDoc: vi.fn(), set: vi.fn(), commit: vi.fn(), setDoc: vi.fn() }));
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ collection: () => ({}), doc: (_db: unknown, ...path: string[]) => path.join('/'), getDocs: mocks.getDocs, getDoc: mocks.getDoc, setDoc: mocks.setDoc, writeBatch: () => ({ set: mocks.set, commit: mocks.commit }) }));
import { seedCasesIfEmpty, seedLocalesIfEmpty } from './seed';
beforeEach(() => { vi.clearAllMocks(); mocks.commit.mockResolvedValue(undefined); });
it('never overwrites an existing cases collection', async () => {
  mocks.getDocs.mockResolvedValue({ empty: false });
  expect(await seedCasesIfEmpty()).toEqual({ skipped: true }); expect(mocks.commit).not.toHaveBeenCalled();
});
it('seeds canonical cases atomically', async () => {
  mocks.getDocs.mockResolvedValue({ empty: true });
  expect(await seedCasesIfEmpty()).toEqual({ skipped: false, imported: 3 });
  expect(mocks.set).toHaveBeenCalledTimes(3); expect(mocks.commit).toHaveBeenCalledTimes(1);
  expect(mocks.set.mock.calls[0][1].ru.subtitle).toBeTruthy();
});
it('preserves existing locale document', async () => {
  mocks.getDoc.mockResolvedValue({ exists: () => true });
  expect(await seedLocalesIfEmpty()).toEqual({ skipped: true }); expect(mocks.setDoc).not.toHaveBeenCalled();
});
