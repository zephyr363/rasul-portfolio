import { beforeEach, expect, it, vi } from 'vitest';
import raw from '../../content/cases.json';
// @ts-expect-error shared contract
import { adaptCase, validateCasesDoc, safeHttpsUrl } from '../../content/cases-contract.mjs';
import type { CaseItem } from '@/content/types';
const mocks = vi.hoisted(() => ({ getDocs: vi.fn(), set: vi.fn(), delete: vi.fn(), commit: vi.fn() }));
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ collection: () => ({}), doc: (_db: unknown, ...parts: string[]) => parts.join('/'), getDocs: mocks.getDocs, writeBatch: () => ({ set: mocks.set, delete: mocks.delete, commit: mocks.commit }) }));
import { getCases, saveCases, invalidateCasesCache } from './cases';
beforeEach(() => invalidateCasesCache());
beforeEach(() => { vi.clearAllMocks(); mocks.commit.mockResolvedValue(undefined); });
const canonical = () => raw.cases.map(adaptCase) as CaseItem[];
it('caches validated cases and invalidates only after successful atomic commit', async () => {
  mocks.getDocs.mockResolvedValue({ docs: raw.cases.map((c, i) => ({ id: `legacy-${i}`, data: () => c })) });
  const first = await getCases();
  first[0].ru.title = 'local edit';
  expect((await getCases())[0].ru.title).not.toBe('local edit');
  expect(mocks.getDocs).toHaveBeenCalledTimes(1);
  mocks.commit.mockRejectedValueOnce(new Error('offline'));
  await expect(saveCases(canonical())).rejects.toThrow('offline');
  await getCases();
  expect(mocks.getDocs).toHaveBeenCalledTimes(1);
  await saveCases(canonical());
  await getCases();
  expect(mocks.getDocs).toHaveBeenCalledTimes(2);
  await getCases({ forceRefresh: true });
  expect(mocks.getDocs).toHaveBeenCalledTimes(3);
});
it('adapts legacy without writes and retains document identity', async () => {
  mocks.getDocs.mockResolvedValue({ docs: raw.cases.map((c, i) => ({ id: `legacy-${i}`, data: () => c })) });
  const cases = await getCases();
  expect(cases[0].ru.subtitle).toBe(raw.cases[0].ru.desc);
  expect(cases[0].sourceId).toBe('legacy-0'); expect(mocks.commit).not.toHaveBeenCalled();
});
it('validates new shape, legacy automation and safe URLs', () => {
  expect(validateCasesDoc(raw).ok).toBe(true);
  expect(adaptCase({ ...raw.cases[0], type: 'automation' }).type).toBe('ai');
  expect(validateCasesDoc({ version: 2, cases: canonical() }).ok).toBe(true);
  expect(validateCasesDoc({ version: 2, cases: [{ ...canonical()[0], url: 'javascript:alert(1)' }] }).ok).toBe(false);
  for (const url of ['http://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', '//example.com']) expect(safeHttpsUrl(url)).toBeUndefined();
});
it('commits atomically, merges at original identity, never sweeps absent docs', async () => {
  await saveCases([{ ...canonical()[0], sourceId: 'original' }]);
  expect(mocks.set).toHaveBeenCalledWith('cases/original', expect.not.objectContaining({ sourceId: expect.anything() }), { merge: true });
  expect(mocks.delete).not.toHaveBeenCalled(); expect(mocks.commit).toHaveBeenCalledTimes(1);
});
it('deletes only explicitly removed document and surfaces commit failure', async () => {
  mocks.commit.mockRejectedValue(new Error('offline'));
  await expect(saveCases([], [{ ...canonical()[0], sourceId: 'original' }])).rejects.toThrow('offline');
  expect(mocks.delete).toHaveBeenCalledWith('cases/original');
});
