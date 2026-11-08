import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";

import type { CaseItem, CasesDocument } from "@/content/types";
import { db } from "@/lib/firebase";
import { invalidateLocalesCache } from "@/data/content";
import { invalidateCasesCache } from "@/data/cases";

// Общие dependency-free ESM-контракты (v1/v2), которые используют и CRM, и
// сборка. TypeScript-типов у них нет, поэтому импорт типизируется как `any`;
// Vite корректно бандлит сам .mjs.
// @ts-expect-error -- у общего .mjs-контракта нет .d.ts
import { adaptCase, validateCasesDoc } from "../../../content/cases-contract.mjs";
// @ts-expect-error -- у общего .mjs-контракта нет .d.ts
import { validateLocalesDoc } from "../../../content/locales-contract.mjs";

// Seed-only импорты шаблонов: публичный сайт на рантайме их НЕ использует
// (источник истины текстов — Firestore). Эти JSON нужны только для первичного
// наполнения Firestore из админки.
import casesJson from "../../../content/cases.json";
import localesJson from "../../../content/locales.json";

type ValidationResult = { ok: true } | { ok: false; errors: string[] };

const LOCALES_PATH = "siteContent/locales";
const CASES_COLLECTION = "cases";

/** Итог импорта шаблона в Firestore. */
export type SeedResult =
  | { skipped: true }
  | { skipped: false; imported: number };

/**
 * Импортирует локали (`siteContent/locales`) из шаблона `content/locales.json`,
 * только если документа ещё нет. Документ прогоняется через общий контракт v2
 * перед записью.
 */
export async function seedLocalesIfEmpty(): Promise<SeedResult> {
  const ref = doc(db, LOCALES_PATH);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return { skipped: true };

  const validation = validateLocalesDoc(localesJson) as ValidationResult;
  if (!validation.ok) {
    throw new Error(`Шаблон локалей невалиден: ${validation.errors.join(", ")}`);
  }

  await setDoc(ref, localesJson);
  invalidateLocalesCache();
  return { skipped: false, imported: 1 };
}

/**
 * Импортирует кейсы (коллекция `cases`) из шаблона `content/cases.json` по
 * одному документу (id = caseId), только если коллекция пуста. Собранный
 * документ `{version:1, cases}` прогоняется через общий контракт v1 перед
 * записью.
 */
export async function seedCasesIfEmpty(): Promise<SeedResult> {
  const snapshot = await getDocs(collection(db, CASES_COLLECTION));
  if (!snapshot.empty) return { skipped: true };

  const cases = (casesJson as unknown as CasesDocument).cases.map(adaptCase);
  const validation = validateCasesDoc({ version: 2, cases }) as ValidationResult;
  if (!validation.ok) {
    throw new Error(`Шаблон кейсов невалиден: ${validation.errors.join(", ")}`);
  }

  const batch = writeBatch(db);
  for (const item of cases as CaseItem[]) batch.set(doc(db, CASES_COLLECTION, item.id), item);
  await batch.commit();
  invalidateCasesCache();
  return { skipped: false, imported: cases.length };
}

/** Понятный текст ошибки импорта (в т.ч. rules / permission-denied). */
export function describeSeedError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/permission-denied|missing or insufficient permissions|unauthorized/i.test(msg)) {
    return "Нет прав на запись в Firestore. Убедитесь, что вы вошли как владелец и правила развёрнуты.";
  }
  return `Ошибка импорта: ${msg}`;
}
