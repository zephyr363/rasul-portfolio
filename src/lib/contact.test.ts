import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMAIL,
  DEFAULT_PHONE,
  DEFAULT_SUBJECT,
  DEFAULT_TELEGRAM_USER,
  buildConsultationMessage,
  buildContactUrls,
} from "./contact";

describe("buildConsultationMessage", () => {
  it("formats RU message with topic and note", () => {
    const msg = buildConsultationMessage({
      lang: "ru",
      topicLabel: "Разработка Backend / API",
      projectNote: "Нужен микросервис оплаты",
    });
    expect(msg).toContain("Формат: Разработка Backend / API.");
    expect(msg).toContain("Задача: Нужен микросервис оплаты");
  });

  it("formats KZ message with topic and note", () => {
    const msg = buildConsultationMessage({
      lang: "kz",
      topicLabel: "Сайт жасау",
      projectNote: "Заявка формасы бар сайт керек",
    });
    expect(msg).toContain("Бағыт: Сайт жасау.");
    expect(msg).toContain("Қысқаша сипаттама: Заявка формасы бар сайт керек");
  });

  it("formats EN message with topic and note", () => {
    const msg = buildConsultationMessage({
      lang: "en",
      topicLabel: "Java Developer (Team)",
      projectNote: "Fintech API integration",
    });
    expect(msg).toContain("Format: Java Developer (Team).");
    expect(msg).toContain("Task details: Fintech API integration");
  });

  it("includes name and contact for RU", () => {
    const msg = buildConsultationMessage({
      lang: "ru",
      name: "Иван",
      contact: "@ivan",
      projectNote: "Нужен сайт",
    });
    expect(msg).toContain("Имя: Иван.");
    expect(msg).toContain("Контакт: @ivan.");
    expect(msg).toContain("Задача: Нужен сайт");
  });

  it("includes name and contact for KZ and EN", () => {
    const kzMsg = buildConsultationMessage({ lang: "kz", name: "Иван", contact: "@ivan" });
    expect(kzMsg).toContain("Аты: Иван.");
    expect(kzMsg).toContain("Байланыс: @ivan.");

    const enMsg = buildConsultationMessage({ lang: "en", name: "Ivan", contact: "@ivan" });
    expect(enMsg).toContain("Name: Ivan.");
    expect(enMsg).toContain("Contact: @ivan.");
  });

  it("trims whitespace and omits empty fields", () => {
    const msg = buildConsultationMessage({
      lang: "ru",
      name: "  Иван  ",
      topicLabel: "   ",
      projectNote: "  Нужен бот  ",
      contact: "",
    });
    expect(msg).toContain("Имя: Иван.");
    expect(msg).not.toContain("Формат:");
    expect(msg).toContain("Задача: Нужен бот");
  });

  it("uses the RU default greeting with no arguments", () => {
    const msg = buildConsultationMessage({});
    expect(msg).toBe(
      "Привет, Расул! Посмотрел(а) твоё портфолио, хочу обсудить сотрудничество.",
    );
  });

  it("respects a custom baseGreeting", () => {
    const msg = buildConsultationMessage({ lang: "ru", baseGreeting: "Здравствуйте!" });
    expect(msg).toBe("Здравствуйте!");
  });
});

describe("buildContactUrls", () => {
  it("builds exact WhatsApp, Telegram and mailto URLs with encoding", () => {
    const message = "Нужен сайт + бот";
    const subject = "Заявка / сайт";
    const urls = buildContactUrls({ message, subject });

    expect(urls.whatsapp).toBe(`https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(message)}`);
    expect(urls.telegram).toBe(
      `https://t.me/${DEFAULT_TELEGRAM_USER}?text=${encodeURIComponent(message)}`,
    );
    expect(urls.mailto).toBe(
      `mailto:${DEFAULT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
    );
  });

  it("encodes reserved characters and spaces", () => {
    const urls = buildContactUrls({ message: "a+b c" });
    expect(urls.whatsapp).toContain("a%2Bb%20c");
    expect(urls.whatsapp).not.toContain(" ");
  });

  it("uses defaults for an empty message", () => {
    const urls = buildContactUrls({});
    expect(urls.whatsapp).toBe(`https://wa.me/${DEFAULT_PHONE}?text=`);
    expect(urls.telegram).toBe(`https://t.me/${DEFAULT_TELEGRAM_USER}?text=`);
    expect(urls.mailto).toBe(
      `mailto:${DEFAULT_EMAIL}?subject=${encodeURIComponent(DEFAULT_SUBJECT)}&body=`,
    );
  });

  it("honours custom phone, user and email", () => {
    const urls = buildContactUrls({
      phone: "79990000000",
      telegramUser: "someone",
      email: "x@example.com",
      message: "hi",
    });
    expect(urls.whatsapp).toBe("https://wa.me/79990000000?text=hi");
    expect(urls.telegram).toBe("https://t.me/someone?text=hi");
    expect(urls.mailto).toBe(`mailto:x@example.com?subject=${encodeURIComponent(DEFAULT_SUBJECT)}&body=hi`);
  });
});
