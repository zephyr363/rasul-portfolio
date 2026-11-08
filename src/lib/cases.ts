import type { CaseItem, CaseLocale, Lang } from "@/content/types";
import { getCases as getCasesFromFirestore } from "@/data/cases";
import type { LoadOptions } from "@/data/memory-cache";

export type { CaseItem };

/**
 * Адаптер кейсов (FB-T4): кейсы из Firestore (коллекция `cases`), уже
 * отсортированы по `order` в data-слое. Без JSON-fallback — при сетевой ошибке
 * или невалидных данных исключение пробрасывается в общий loading/error-контекст
 * `App`.
 */
export async function getCases(options?: LoadOptions): Promise<CaseItem[]> {
  return options ? getCasesFromFirestore(options) : getCasesFromFirestore();
}

/** Локализованные строки кейса; при отсутствии языка — fallback на `ru`. */
export function getCaseLocale(item: CaseItem, lang: Lang): CaseLocale {
  const locale = item[lang] ?? item.ru;
  return { ...locale, subtitle: locale.subtitle ?? locale.desc ?? '' };
}

/** Поиск кейса по id в уже загруженном списке. */
export function getCaseById(cases: readonly CaseItem[], id: string): CaseItem | undefined {
  return cases.find((item) => item.id === id);
}
