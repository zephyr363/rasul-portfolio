import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import type { CaseItem } from "@/content/types";
import { db } from "@/lib/firebase";
import { createMemoryCache, type LoadOptions } from "./memory-cache";
// @ts-expect-error shared dependency-free contract
import { adaptCase, validateCasesDoc } from "../../content/cases-contract.mjs";

async function loadCases(): Promise<CaseItem[]> {
  const snapshot = await getDocs(collection(db, "cases"));
  const cases = snapshot.docs.map(d => ({ ...adaptCase(d.data()), sourceId: d.id })) as CaseItem[];
  const result = validateCasesDoc({ version: 1, cases });
  if (!result.ok) throw new Error(`Invalid cases: ${result.errors.join(', ')}`);
  return cases.sort((a, b) => a.order - b.order);
}

const casesCache = createMemoryCache(loadCases);
export const invalidateCasesCache = casesCache.invalidate;
export function getCases(options?: LoadOptions): Promise<CaseItem[]> {
  return casesCache.get(options);
}

/** Explicit deletions only: unrelated/legacy documents are never swept away. */
export async function saveCases(all: CaseItem[], deleted: CaseItem[] = []): Promise<void> {
  const cases = all.map((item, index) => ({ ...item, order: index + 1 }));
  const result = validateCasesDoc({ version: 2, cases });
  if (!result.ok) throw new Error(`Invalid cases: ${result.errors.join(', ')}`);
  if (cases.length + deleted.length > 500) throw new Error('Too many changes for one atomic save.');
  const batch = writeBatch(db);
  for (const item of cases) {
    const { sourceId } = item;
    const content = {
      id: item.id, order: item.order, type: item.type,
      ...(item.url ? { url: item.url } : { url: '' }),
      ...(item.previewImageUrl ? { previewImageUrl: item.previewImageUrl } : { previewImageUrl: '' }),
      ru: { title: item.ru.title, subtitle: item.ru.subtitle },
      kz: { title: item.kz.title, subtitle: item.kz.subtitle },
      en: { title: item.en.title, subtitle: item.en.subtitle },
    };
    batch.set(doc(db, 'cases', sourceId ?? item.id), content, { merge: true });
  }
  for (const item of deleted) batch.delete(doc(db, 'cases', item.sourceId ?? item.id));
  await batch.commit();
  invalidateCasesCache();
}
export function describeCasesError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
