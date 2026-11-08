import { beforeEach, describe, expect, it, vi } from "vitest";

import raw from "../../content/locales.json";

// Моки SDK: data-слой обращается к Firestore через getDoc/doc, а `@/lib/firebase`
// при инициализации трогает initializeApp/getFirestore/getAuth/setPersistence.
// Реальные сетевые вызовы Firebase из тестов не выполняются.
const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  doc: vi.fn(() => ({ path: "siteContent/locales" })),
  setDoc: vi.fn<(ref: unknown, data: unknown) => Promise<void>>(() => Promise.resolve()),
  initializeApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  getFirestore: vi.fn(() => ({})),
  getAuth: vi.fn(() => ({})),
  setPersistence: vi.fn(() => Promise.resolve()),
}));

vi.mock("firebase/app", () => ({ initializeApp: mocks.initializeApp }));
vi.mock("firebase/firestore", () => ({
  getFirestore: mocks.getFirestore,
  getDoc: mocks.getDoc,
  doc: mocks.doc,
  setDoc: mocks.setDoc,
}));
vi.mock("firebase/auth", () => ({
  getAuth: mocks.getAuth,
  setPersistence: mocks.setPersistence,
  browserLocalPersistence: "LOCAL",
}));

import { getLocales, saveLocales, validateContentDoc, invalidateLocalesCache } from "./content";
beforeEach(() => invalidateLocalesCache());

it('caches validated locales, invalidates only successful saves and bypasses on refresh', async () => {
  mocks.getDoc.mockResolvedValue(snapshotOf(validDoc()));
  mocks.setDoc.mockResolvedValue(undefined);
  await getLocales();
  await getLocales();
  const reads = mocks.getDoc.mock.calls.length;
  mocks.setDoc.mockRejectedValueOnce(new Error('offline'));
  await expect(saveLocales(validDoc() as unknown as ContentDoc)).rejects.toThrow('offline');
  await getLocales();
  expect(mocks.getDoc).toHaveBeenCalledTimes(reads);
  await saveLocales(validDoc() as unknown as ContentDoc);
  await getLocales();
  expect(mocks.getDoc).toHaveBeenCalledTimes(reads + 1);
  await getLocales({ forceRefresh: true });
  expect(mocks.getDoc).toHaveBeenCalledTimes(reads + 2);
});
import type { ContentDoc } from "./content";

/** Глубокая копия реального документа локалей (тесты не мутируют общий импорт). */
function validDoc(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
}

function snapshotOf(data: unknown | undefined, exists = true) {
  return { exists: () => exists, data: () => data };
}

/** Удаляет блок `next` из всех локалей — симуляция старого документа Firestore. */
function stripNext(doc: Record<string, unknown>): Record<string, unknown> {
  for (const lang of ["ru", "kz", "en"]) {
    const locale = (doc.locales as Record<string, Record<string, unknown>>)[lang];
    delete locale.next;
  }
  return doc;
}

describe("data/content — getLocales из Firestore", () => {
  it("возвращает типизированный документ при валидных данных", async () => {
    mocks.getDoc.mockResolvedValue(snapshotOf(validDoc()));

    const docData = await getLocales();

    expect(docData.version).toBe(1);
    expect(Object.keys(docData.locales).sort()).toEqual(["en", "kz", "ru"]);
    expect(docData.locales.ru.lang).toBe("ru");
    expect(docData.locales.ru.hero.title).toBe("Привет, меня зовут Расул");
    expect(mocks.doc).toHaveBeenCalledWith(expect.anything(), "siteContent/locales");
  });

  it("принимает старый документ без блока next (обратная совместимость)", async () => {
    mocks.getDoc.mockResolvedValue(snapshotOf(stripNext(validDoc())));

    const docData = await getLocales();

    expect(docData.version).toBe(1);
    expect(docData.locales.ru.hero.title).toBe("Привет, меня зовут Расул");
    expect(docData.locales.ru.next).toBeUndefined();
  });

  it("бросает ошибку при невалидном документе (не проходит контракт)", async () => {
    const broken = validDoc();
    (broken.locales as Record<string, unknown>).ru = { lang: "ru" }; // битая структура

    mocks.getDoc.mockResolvedValue(snapshotOf(broken));

    await expect(getLocales()).rejects.toThrow(/валидацию контрактом/);
  });

  it("бросает ошибку, когда документ отсутствует", async () => {
    mocks.getDoc.mockResolvedValue(snapshotOf(undefined, false));

    await expect(getLocales()).rejects.toThrow(/не найден в Firestore/);
  });

  it("бросает понятную ошибку при сетевом сбое (без JSON-fallback)", async () => {
    mocks.getDoc.mockRejectedValue(new Error("permission-denied"));

    await expect(getLocales()).rejects.toThrow(
      /Не удалось загрузить локали из Firestore/,
    );
    await expect(getLocales()).rejects.toThrow(/permission-denied/);
  });
});

describe("data/content — saveLocales / validateContentDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setDoc.mockResolvedValue(undefined);
  });

  it("пишет валидный документ целиком в siteContent/locales", async () => {
    const docData = validDoc() as unknown as ContentDoc;

    await saveLocales(docData);

    expect(mocks.doc).toHaveBeenCalledWith(expect.anything(), "siteContent/locales");
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    const [, data] = mocks.setDoc.mock.calls[0];
    expect(data).toEqual(docData);
  });

  it("бросает ошибку при невалидном документе и не пишет", async () => {
    const broken = validDoc() as unknown as {
      locales: Record<string, { hero: { title: string } }>;
    };
    broken.locales.ru.hero.title = "";

    await expect(saveLocales(broken as unknown as ContentDoc)).rejects.toThrow(
      /валидацию контрактом/,
    );
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("validateContentDoc: пустой список для валидного, ошибки для битого", () => {
    expect(validateContentDoc(validDoc())).toEqual([]);

    const broken = validDoc() as unknown as {
      locales: Record<string, { hero: { title: string } }>;
    };
    broken.locales.ru.hero.title = "";
    expect(validateContentDoc(broken).length).toBeGreaterThan(0);
  });

  it("validateContentDoc: старый документ без next валиден", () => {
    expect(validateContentDoc(stripNext(validDoc()))).toEqual([]);
  });
});
