import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Lang, LocaleCopy } from "@/content/types";
import { LanguageProvider } from "@/lib/i18n";

import raw from "../../content/locales.json";

import { Services } from "./Services";

/**
 * Секция «Услуги». Утверждённый макет mockup-v2 — статичная текст-колонка +
 * теги «Мои возможности» (аккордеон из REWRITE-ARCH отменён решением CEO/координатора).
 * Тесты проверяют фактический UI, а не раскрытие по клику.
 */

type ContentDoc = { version: 1; locales: Record<Lang, LocaleCopy> };

function contentFixture(): ContentDoc {
  return JSON.parse(JSON.stringify(raw)) as ContentDoc;
}

function renderServices() {
  return render(
    <LanguageProvider content={contentFixture()}>
      <Services />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "";
});

describe("Services", () => {
  it("рендерит заголовок секции и все возможности", () => {
    renderServices();

    expect(screen.getByRole("heading", { level: 2, name: /Услуги — Что я делаю/ })).toBeInTheDocument();
    expect(screen.getByText("Мои возможности")).toBeInTheDocument();

    for (const capability of [
      "Сайты для бизнеса",
      "Telegram-боты",
      "ИИ-агенты",
      "Автоматизация",
    ]) {
      expect(screen.getByText(capability)).toBeInTheDocument();
    }
    // 5-й тег «Быстро и с телефона» удалён по решению CEO.
    expect(screen.queryByText("Быстро и с телефона")).toBeNull();
  });

  it("имеет якорь #services и legacy-алиас #expertise", () => {
    renderServices();

    expect(document.getElementById("services")).toBeInTheDocument();
    expect(document.getElementById("expertise")).toBeInTheDocument();
  });

  it("переводит тексты секции", () => {
    window.localStorage.setItem("rasul-language", "en");
    renderServices();

    expect(screen.getByRole("heading", { level: 2, name: /Services — What I do/ })).toBeInTheDocument();
    expect(screen.getByText("My capabilities")).toBeInTheDocument();
    expect(screen.getByText("Telegram bots")).toBeInTheDocument();
  });

  // Текст-колонка: intro + body + result. По тексту — 4 услуги
  // (сайт, Telegram-бот, ИИ-агент, автоматизация), как в mockup-v2.
  it("показывает текст-колонку с описанием 4 услуг", () => {
    renderServices();

    const intro = screen.getByText(/Сайт, с которого клиенты пишут и оставляют заявки/);
    expect(intro).toBeInTheDocument();

    const body = screen.getByText(/Бот принимает заказы и отвечает клиентам/);
    expect(body).toBeInTheDocument();
    expect(body.textContent).toContain("ИИ отвечает на типовые вопросы");
    expect(body.textContent).toContain("Автоматизация связывает заявки");

    expect(screen.getByText(/Результат:/)).toBeInTheDocument();
  });

  // Теги «Мои возможности»: заголовок + сами теги с #-префиксом.
  it("рендерит теги «Мои возможности» для каждой услуги", () => {
    renderServices();

    expect(
      screen.getByRole("heading", { level: 3, name: "Мои возможности" }),
    ).toBeInTheDocument();

    for (const capability of [
      "Сайты для бизнеса",
      "Telegram-боты",
      "ИИ-агенты",
      "Автоматизация",
    ]) {
      const tag = screen.getByText(capability);
      expect(tag).toBeInTheDocument();
      // Тег визуально ведёт на «Мои возможности» и не является ссылкой/кнопкой —
      // это обычная метка-спан, а не раскрывающийся контрол.
      expect(tag.closest("span")).toBeInTheDocument();
    }

    expect(screen.queryByText("Быстро и с телефона")).toBeNull();
  });
});
