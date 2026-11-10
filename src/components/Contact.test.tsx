import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Lang, LocaleCopy } from "@/content/types";
import { buildContactUrls } from "@/lib/contact";
import { LanguageProvider } from "@/lib/i18n";

import raw from "../../content/locales.json";

import { Contact } from "./Contact";

/**
 * UI-проводка контактов. Само построение URL и кодирование уже покрыто
 * `src/lib/contact.test.ts` — здесь проверяем, что компонент использует именно
 * эти значения, что форма форматирует/валидирует телефон и сохраняет заявку в
 * Firestore через `createLead` (без auto-Telegram-фолбэка).
 */

const STORAGE_KEY = "rasul-language";

// Моки data-слоя: Contact → @/data/leads.createLead (Firestore).
const mocks = vi.hoisted(() => ({
  createLead: vi.fn(),
}));

vi.mock("@/data/leads", () => ({ createLead: mocks.createLead }));

type ContentDoc = { version: 1; locales: Record<Lang, LocaleCopy> };

function contentFixture(): ContentDoc {
  return JSON.parse(JSON.stringify(raw)) as ContentDoc;
}

function renderContact() {
  return render(
    <LanguageProvider content={contentFixture()}>
      <Contact />
    </LanguageProvider>,
  );
}

function contactSection() {
  const section = document.getElementById("contact");
  if (!section) throw new Error("#contact не отрендерен");
  return section;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "";
  mocks.createLead.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contact: форма", () => {
  it("связывает labels только с двумя полями (имя и телефон), без поля «Задача»", () => {
    renderContact();

    expect(screen.getByLabelText("Имя")).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText("Номер телефона")).toBeInstanceOf(HTMLInputElement);
    expect(screen.queryByLabelText("Задача")).toBeNull();
    expect(screen.queryByLabelText("Контакт")).toBeNull();
  });

  it("кнопка формы — submit-кнопка (не фейковая ссылка)", () => {
    renderContact();

    const submit = screen.getByRole("button", { name: "Отправить заявку" });
    expect(submit).toHaveAttribute("type", "submit");
  });

  it("форматирует ввод в маску +7 (999) 999-99-99", () => {
    renderContact();

    const phone = screen.getByLabelText("Номер телефона");
    fireEvent.change(phone, { target: { value: "89999999999" } });
    expect(phone).toHaveValue("+7 (999) 999-99-99");
  });

  it("приводит первую цифру к 7 (ввод с 8 → +7)", () => {
    renderContact();

    const phone = screen.getByLabelText("Номер телефона");
    fireEvent.change(phone, { target: { value: "8" } });
    expect(phone).toHaveValue("+7");
  });

  it("позволяет полностью очистить номер (а не оставляет +7)", () => {
    renderContact();

    const phone = screen.getByLabelText("Номер телефона");
    fireEvent.change(phone, { target: { value: "89999999999" } });
    expect(phone).toHaveValue("+7 (999) 999-99-99");
    fireEvent.change(phone, { target: { value: "+7" } });
    expect(phone).toHaveValue("");
  });

  it("не отправляет заявку при неполном номере и показывает ошибку", async () => {
    renderContact();

    fireEvent.change(screen.getByLabelText("Имя"), { target: { value: "Иван" } });
    fireEvent.change(screen.getByLabelText("Номер телефона"), { target: { value: "8999123" } });

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(screen.getByText("Введите номер полностью")).toBeInTheDocument();
    expect(mocks.createLead).not.toHaveBeenCalled();
  });

  it("содержит скрытое honeypot-поле hp (пустое, aria-hidden, tabindex -1, autocomplete off)", () => {
    const { container } = renderContact();

    const hp = container.querySelector<HTMLInputElement>('input[name="hp"]');
    expect(hp).not.toBeNull();
    expect(hp!.value).toBe("");
    expect(hp).toHaveAttribute("aria-hidden", "true");
    expect(hp).toHaveAttribute("tabindex", "-1");
    expect(hp).toHaveAttribute("autocomplete", "off");
  });

  it("сохраняет заявку через createLead в Firestore и показывает успех", async () => {
    mocks.createLead.mockResolvedValue("lead-1");
    renderContact();

    fireEvent.change(screen.getByLabelText("Имя"), { target: { value: "Иван" } });
    fireEvent.change(screen.getByLabelText("Номер телефона"), { target: { value: "89991234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    await waitFor(() => expect(screen.getByText("Заявка отправлена ✓")).toBeInTheDocument());

    expect(mocks.createLead).toHaveBeenCalledTimes(1);
    expect(mocks.createLead).toHaveBeenCalledWith({
      name: "Иван",
      phone: "+7 (999) 123-45-67",
      hp: "",
    });

    // Форма очищается после успеха.
    expect(screen.getByLabelText("Имя")).toHaveValue("");
    expect(screen.getByLabelText("Номер телефона")).toHaveValue("");
  });

  it("блокирует повторный сабмит после успеха до изменения полей", async () => {
    mocks.createLead.mockResolvedValue("lead-1");
    renderContact();

    fireEvent.change(screen.getByLabelText("Имя"), { target: { value: "Иван" } });
    fireEvent.change(screen.getByLabelText("Номер телефона"), { target: { value: "89991234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    await waitFor(() => expect(screen.getByText("Заявка отправлена ✓")).toBeInTheDocument());

    // Поля очищены → повторный сабмит не уходит (валидация пустого имени).
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    await waitFor(() => expect(mocks.createLead).toHaveBeenCalledTimes(1));
  });

  it("показывает submitError при ошибке Firestore (без Telegram-фолбэка)", async () => {
    mocks.createLead.mockRejectedValue(new Error("permission-denied"));
    renderContact();

    fireEvent.change(screen.getByLabelText("Имя"), { target: { value: "Иван" } });
    fireEvent.change(screen.getByLabelText("Номер телефона"), { target: { value: "89991234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не удалось отправить заявку. Попробуйте ещё раз.");
    expect(mocks.createLead).toHaveBeenCalledTimes(1);
    // Заявка не теряется молча: без auto-open Telegram при ошибке сабмита.
    expect(screen.queryByText("Заявка отправлена ✓")).toBeNull();
  });

  it("использует активную локаль для текстов формы (EN)", async () => {
    window.localStorage.setItem(STORAGE_KEY, "en");
    mocks.createLead.mockResolvedValue("lead-1");
    renderContact();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ivan" } });
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "89991234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(screen.getByText("Request sent ✓")).toBeInTheDocument());
    expect(mocks.createLead).toHaveBeenCalledWith({
      name: "Ivan",
      phone: "+7 (999) 123-45-67",
      hp: "",
    });
  });
});

describe("Contact: кнопки-платформы", () => {
  it("ведёт на t.me, wa.me и mailto из lib/contact с SVG-иконками", () => {
    renderContact();

    const urls = buildContactUrls({});
    const section = contactSection();

    const telegram = within(section).getByRole("link", { name: /Telegram/ });
    expect(telegram).toHaveAttribute("href", urls.telegram);
    expect(telegram).toHaveAttribute("target", "_blank");
    expect(telegram).toHaveAttribute("rel", "noopener noreferrer");
    expect(telegram.querySelector("svg")).not.toBeNull();

    const whatsapp = within(section).getByRole("link", { name: /WhatsApp/ });
    expect(whatsapp).toHaveAttribute("href", urls.whatsapp);
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp.querySelector("svg")).not.toBeNull();

    const email = within(section).getByRole("link", { name: /Email/ });
    expect(email).toHaveAttribute("href", urls.mailto);
    expect(email.querySelector("svg")).not.toBeNull();
  });

  it("не дублирует legacy-плейсхолдеры и держит боевые контакты", () => {
    renderContact();

    const section = contactSection();
    expect(section.innerHTML).not.toMatch(/example\.(com|org)/i);
    expect(section.innerHTML).toContain("77085480859");
    expect(section.innerHTML).toContain("ahmetov_rasul");
    expect(section.innerHTML).toContain("rasulakhmetov2004@gmail.com");
  });
});
