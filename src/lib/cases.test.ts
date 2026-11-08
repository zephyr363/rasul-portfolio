import { describe, expect, it, vi } from "vitest";

import type { CaseItem } from "@/content/types";

import raw from "../../content/cases.json";

// Моки data-слоя: адаптер `src/lib/cases.ts` делегирует загрузку в
// `@/data/cases.getCases` (Firestore). Реальный Firestore в тестах не трогаем.
const mocks = vi.hoisted(() => ({
  getCases: vi.fn(),
}));

vi.mock("@/data/cases", () => ({ getCases: mocks.getCases }));

import { getCaseById, getCaseLocale, getCases } from "./cases";

/** Глубокая копия реальных кейсов (тесты не мутируют общий импорт). */
function validCases(): CaseItem[] {
  return JSON.parse(JSON.stringify(raw.cases)) as CaseItem[];
}

describe("cases adapter (src/lib/cases.ts)", () => {
  it("возвращает кейсы из data-слоя (Firestore)", async () => {
    const cases = validCases();
    mocks.getCases.mockResolvedValue(cases);

    await expect(getCases()).resolves.toBe(cases);
    expect(mocks.getCases).toHaveBeenCalledTimes(1);
  });

  it("пробрасывает ошибку загрузки без fallback", async () => {
    mocks.getCases.mockRejectedValue(new Error("unavailable"));

    await expect(getCases()).rejects.toThrow("unavailable");
  });
});

describe("cases pure helpers", () => {
  it("находит кейс по id в загруженном списке", () => {
    const cases = validCases();
    expect(getCaseById(cases, "access-control")?.ru.title).toBe(
      "Защищённый вход и разграничение прав",
    );
    expect(getCaseById(cases, "does-not-exist")).toBeUndefined();
  });

  it("возвращает запрошенную локаль кейса", () => {
    const item = getCaseById(validCases(), "parcel-status");
    expect(item).toBeDefined();
    expect(getCaseLocale(item!, "ru").title).toBe("Быстрее обработка статусов посылок");
    expect(getCaseLocale(item!, "kz").title).toBe("Сәлемдеме мәртебесін жылдам өңдеу");
    expect(getCaseLocale(item!, "en").title).toBe("Faster parcel status handling");
  });

  it("у каждого кейса полные локали ru/kz/en с буллетами", () => {
    for (const item of validCases()) {
      for (const lang of ["ru", "kz", "en"] as const) {
        const loc = getCaseLocale(item, lang);
        expect(loc.title).toBeTruthy();
        expect(loc.subtitle).toBeTruthy();
      }
    }
  });
});
