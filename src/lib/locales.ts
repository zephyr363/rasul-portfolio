import { getLocales as getLocalesFromFirestore, type ContentDoc } from "@/data/content";
import type { LoadOptions } from "@/data/memory-cache";

export type { ContentDoc };

/**
 * Адаптер контента (FB-T4): единый источник истины текстов сайта — Firestore
 * (`siteContent/locales`). На рантайме НЕ импортируется `content/locales.json` и
 * нет JSON-fallback: `getLocales()` выбрасывает исключение при сетевой ошибке,
 * отсутствии или невалидности документа, а `App` показывает экран ошибки с
 * кнопкой «Повторить» (fail-closed — сайт не отдаёт битый контент).
 */
export async function getLocales(options?: LoadOptions): Promise<ContentDoc> {
  return options ? getLocalesFromFirestore(options) : getLocalesFromFirestore();
}
