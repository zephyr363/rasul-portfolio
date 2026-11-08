import { describe, expect, it, vi } from "vitest";

import type { Lang, LocaleCopy } from "@/content/types";

import raw from "../../content/locales.json";

// Моки data-слоя: адаптер `src/lib/locales.ts` делегирует загрузку в
// `@/data/content.getLocales` (Firestore). Реальный Firestore в тестах не трогаем.
const mocks = vi.hoisted(() => ({
  getLocales: vi.fn(),
}));

vi.mock("@/data/content", () => ({ getLocales: mocks.getLocales }));

import { getLocales } from "./locales";

type ContentDoc = { version: 1; locales: Record<Lang, LocaleCopy> };

/** Глубокая копия реального документа локалей (тесты не мутируют общий импорт). */
function validDoc(): ContentDoc {
  return JSON.parse(JSON.stringify(raw)) as ContentDoc;
}

describe("locales adapter (src/lib/locales.ts)", () => {
  it("возвращает документ локалей из data-слоя (Firestore)", async () => {
    const doc = validDoc();
    mocks.getLocales.mockResolvedValue(doc);

    await expect(getLocales()).resolves.toBe(doc);
    expect(mocks.getLocales).toHaveBeenCalledTimes(1);
  });

  it("пробрасывает ошибку загрузки без fallback", async () => {
    mocks.getLocales.mockRejectedValue(new Error("permission-denied"));

    await expect(getLocales()).rejects.toThrow("permission-denied");
  });
});
