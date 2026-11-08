import { doc, getDoc, setDoc, type DocumentSnapshot } from "firebase/firestore";

import type { Lang, LocaleCopy } from "@/content/types";
import { db } from "@/lib/firebase";
import { createMemoryCache, type LoadOptions } from "./memory-cache";

// content/locales-contract.mjs — общий dependency-free ESM-контракт (v2),
// который используют и CRM, и фронтенд-сборка, и CI. TypeScript-типов у него
// нет, поэтому импорт типизируется как `any`; Vite корректно бандлит сам .mjs.
// @ts-expect-error -- у общего .mjs-контракта нет .d.ts
import { validateLocalesDoc } from "../../content/locales-contract.mjs";

type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** Типизированный документ локалей (siteContent/locales в Firestore). */
export interface ContentDoc {
  version: 1;
  locales: Record<Lang, LocaleCopy>;
}

const LOCALES_PATH = "siteContent/locales";

function assertValid(doc: unknown): ContentDoc {
  const errors = validateContentDoc(doc);
  if (errors.length) {
    throw new Error(
      `Документ локалей (${LOCALES_PATH}) не прошёл валидацию контрактом: ${errors.join(", ")}`,
    );
  }
  return doc as unknown as ContentDoc;
}

/**
 * Локальная валидация документа локалей общим контрактом v2. Возвращает список
 * ошибок (пустой — документ валиден). Используется и CRM (показ ошибок по
 * полям до записи), и `getLocales`/`saveLocales` (fail-closed).
 */
export function validateContentDoc(doc: unknown): string[] {
  const validation = validateLocalesDoc(doc) as ValidationResult;
  return validation.ok ? [] : validation.errors;
}

/**
 * Локали из Firestore (`siteContent/locales`) — единый источник истины текстов
 * сайта. Без JSON-fallback: при сетевой ошибке или невалидном документе
 * выбрасывается исключение, чтобы fail-closed (сайт не отдаёт битый контент).
 */
async function loadLocales(): Promise<ContentDoc> {
  let snapshot: DocumentSnapshot;
  try {
    snapshot = await getDoc(doc(db, LOCALES_PATH));
  } catch (err) {
    throw new Error(
      `Не удалось загрузить локали из Firestore (${LOCALES_PATH}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!snapshot.exists()) {
    throw new Error(`Документ локалей (${LOCALES_PATH}) не найден в Firestore`);
  }

  return assertValid(snapshot.data());
}

const localesCache = createMemoryCache(loadLocales);
export const invalidateLocalesCache = localesCache.invalidate;
export function getLocales(options?: LoadOptions): Promise<ContentDoc> {
  return localesCache.get(options);
}

/**
 * Сохраняет документ локалей целиком (`siteContent/locales`) — last-write-wins
 * (ревизий в Firestore нет, предполагается один админ). Документ прогоняется
 * через общий контракт v2 перед записью: невалидный — throw без записи.
 */
export async function saveLocales(docData: ContentDoc): Promise<void> {
  const errors = validateContentDoc(docData);
  if (errors.length) {
    throw new Error(
      `Документ локалей (${LOCALES_PATH}) не прошёл валидацию контрактом: ${errors.join(", ")}`,
    );
  }
  await setDoc(doc(db, LOCALES_PATH), docData);
  invalidateLocalesCache();
}

/**
 * Понятный текст ошибки контента: permission-denied → «войдите владельцем»,
 * иначе — исходное сообщение (сетевые/валидационные ошибки уже человекочитаемы).
 */
export function describeContentError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  const msg = err instanceof Error ? err.message : String(err);

  if (code === "permission-denied") {
    return "Нет доступа: войдите под аккаунтом владельца.";
  }
  return msg;
}
