import { describe, expect, it } from "vitest";

import type { Lang, LocaleCopy } from "@/content/types";

import raw from "../../content/locales.json";

import { SUPPORTED_LANGS, getLocale, htmlLangFor, isLang, normalizeLang } from "./i18n";

/** Локали из реального документа контента (как их отдаёт Firestore-адаптер). */
const LOCALES = (raw as { locales: Record<Lang, LocaleCopy> }).locales;

/** Рекурсивная «форма» объекта: ключи + типы листьев (для сверки ru/kz/en). */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = shape((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return typeof value;
}

describe("i18n pure logic", () => {
  it("declares ru, kz, en as supported languages", () => {
    expect(SUPPORTED_LANGS).toEqual(["ru", "kz", "en"]);
  });

  it("isLang accepts only valid language codes", () => {
    expect(isLang("ru")).toBe(true);
    expect(isLang("kz")).toBe(true);
    expect(isLang("en")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang("RU")).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang(42)).toBe(false);
  });

  it("normalizeLang falls back to ru for invalid values", () => {
    expect(normalizeLang("en")).toBe("en");
    expect(normalizeLang("kz")).toBe("kz");
    expect(normalizeLang("xx")).toBe("ru");
    expect(normalizeLang(null)).toBe("ru");
    expect(normalizeLang(undefined)).toBe("ru");
  });

  it("getLocale returns the matching copy object", () => {
    expect(getLocale(LOCALES, "ru")).toBe(LOCALES.ru);
    expect(getLocale(LOCALES, "kz")).toBe(LOCALES.kz);
    expect(getLocale(LOCALES, "en")).toBe(LOCALES.en);
  });

  it("htmlLangFor maps kz to kk", () => {
    expect(htmlLangFor("ru")).toBe("ru");
    expect(htmlLangFor("kz")).toBe("kk");
    expect(htmlLangFor("en")).toBe("en");
  });

  it("all locales expose the same key structure (no missing/extra keys)", () => {
    expect(shape(LOCALES.ru)).toEqual(shape(LOCALES.kz));
    expect(shape(LOCALES.ru)).toEqual(shape(LOCALES.en));
  });

  it("all locales declare their own lang", () => {
    expect(LOCALES.ru.lang).toBe("ru");
    expect(LOCALES.kz.lang).toBe("kz");
    expect(LOCALES.en.lang).toBe("en");
  });
});
