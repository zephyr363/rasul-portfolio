import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Lang, LocaleCopy } from "@/content/types";
import { LanguageProvider } from "@/lib/i18n";

import raw from "../../content/locales.json";

import { SectionNext, type NextKey } from "./SectionNext";

/**
 * Переход-строки должны показываться сразу, даже для старых документов Firestore
 * без блока `next`: используется фолбэк-текст из единой константы (NEXT_FALLBACK).
 */

type ContentDoc = { version: 1; locales: Record<Lang, LocaleCopy> };

function contentFixture(withoutNext: boolean): ContentDoc {
  const doc = JSON.parse(JSON.stringify(raw)) as ContentDoc;
  if (withoutNext) {
    for (const lang of ["ru", "kz", "en"] as const) {
      delete doc.locales[lang].next;
    }
  }
  return doc;
}

function renderNext(kind: NextKey, withoutNext: boolean) {
  return render(
    <LanguageProvider content={contentFixture(withoutNext)}>
      <SectionNext href="#services" kind={kind} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "";
});

describe("SectionNext: фолбэк при отсутствии next", () => {
  it("рендерит дефолтный текст (RU) для старого документа", () => {
    renderNext("toServices", true);

    expect(
      screen.getByRole("link", { name: "Что я могу сделать для вашего бизнеса ↓" }),
    ).toHaveAttribute("href", "#services");
  });

  it("рендерит дефолтный текст активной локали (EN)", () => {
    window.localStorage.setItem("rasul-language", "en");
    renderNext("toAbout", true);

    expect(
      screen.getByRole("link", { name: "Who I am and how I can help ↓" }),
    ).toHaveAttribute("href", "#services");
  });

  it("предпочитает значение next, когда блок присутствует", () => {
    const doc = contentFixture(false);
    doc.locales.ru.next = {
      toAbout: "CUSTOM about ↓",
      toServices: "CUSTOM services ↓",
      toCases: "CUSTOM cases ↓",
      toContact: "CUSTOM contact ↓",
    };

    render(
      <LanguageProvider content={doc}>
        <SectionNext href="#services" kind="toServices" />
      </LanguageProvider>,
    );

    expect(screen.getByRole("link", { name: "CUSTOM services ↓" })).toHaveAttribute(
      "href",
      "#services",
    );
  });
});
