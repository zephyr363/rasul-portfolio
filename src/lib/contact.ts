import type { Lang } from "@/content/types";

/**
 * Логика контактов (brief-форма), портированная из legacy-логики
 * на TypeScript с сохранением точной семантики. Плюс расширение: name/contact,
 * которых не было в legacy-версии, но есть в brief-форме mockup-v2.
 *
 * Тексты самих полей формы (labels/placeholder/CTA) лежат в локалях
 * (`content/locales.json`, `contact.form`), т.к. они переводятся.
 */

export interface ConsultationDraft {
  lang?: Lang;
  /** Тема/формат обращения (опционально). */
  topicLabel?: string;
  /** Краткое описание задачи (поле «Задача» формы). */
  projectNote?: string;
  /** Имя клиента (поле «Имя» формы). */
  name?: string;
  /** Контакт клиента (поле «Контакт» формы). */
  contact?: string;
  baseGreeting?: string;
}

export interface ContactUrls {
  whatsapp: string;
  telegram: string;
  mailto: string;
}

export interface ContactUrlsInput {
  phone?: string;
  telegramUser?: string;
  email?: string;
  message?: string;
  subject?: string;
}

export const DEFAULT_PHONE = "77085480859";
export const DEFAULT_TELEGRAM_USER = "ahmetov_rasul";
export const DEFAULT_EMAIL = "rasulakhmetov2004@gmail.com";
// Точная семантика legacy: subject по умолчанию сохранён без изменений.
export const DEFAULT_SUBJECT = "Сотрудничество / Backend Project";

const DEFAULT_GREETING: Record<Lang, string> = {
  ru: "Привет, Расул! Посмотрел(а) твоё портфолио, хочу обсудить сотрудничество.",
  kz: "Сәлем, Расул! Портфолиоңды көрдім, жоба бойынша байланысқым келеді.",
  en: "Hi Rasul! I saw your portfolio and would like to discuss cooperation.",
};

/**
 * Собирает сообщение для Telegram/WhatsApp/email из полей brief-формы.
 * Порядок: приветствие → имя → контакт → формат(тема) → задача. Пустые части
 * пропускаются; значения триммятся.
 */
export function buildConsultationMessage({
  lang = "ru",
  topicLabel = "",
  projectNote = "",
  name = "",
  contact = "",
  baseGreeting = "",
}: ConsultationDraft): string {
  const cleanTopic = String(topicLabel ?? "").trim();
  const cleanNote = String(projectNote ?? "").trim();
  const cleanName = String(name ?? "").trim();
  const cleanContact = String(contact ?? "").trim();

  const parts: string[] = [baseGreeting || DEFAULT_GREETING[lang]];

  if (lang === "en") {
    if (cleanName) parts.push(`Name: ${cleanName}.`);
    if (cleanContact) parts.push(`Contact: ${cleanContact}.`);
    if (cleanTopic) parts.push(`Format: ${cleanTopic}.`);
    if (cleanNote) parts.push(`Task details: ${cleanNote}`);
    return parts.join(" ");
  }

  if (lang === "kz") {
    if (cleanName) parts.push(`Аты: ${cleanName}.`);
    if (cleanContact) parts.push(`Байланыс: ${cleanContact}.`);
    if (cleanTopic) parts.push(`Бағыт: ${cleanTopic}.`);
    if (cleanNote) parts.push(`Қысқаша сипаттама: ${cleanNote}`);
    return parts.join(" ");
  }

  if (cleanName) parts.push(`Имя: ${cleanName}.`);
  if (cleanContact) parts.push(`Контакт: ${cleanContact}.`);
  if (cleanTopic) parts.push(`Формат: ${cleanTopic}.`);
  if (cleanNote) parts.push(`Задача: ${cleanNote}`);
  return parts.join(" ");
}

/** Ссылки WhatsApp / Telegram / mailto с корректным percent-кодированием. */
export function buildContactUrls({
  phone = DEFAULT_PHONE,
  telegramUser = DEFAULT_TELEGRAM_USER,
  email = DEFAULT_EMAIL,
  message = "",
  subject = DEFAULT_SUBJECT,
}: ContactUrlsInput): ContactUrls {
  const encodedMsg = encodeURIComponent(message);
  const encodedSubj = encodeURIComponent(subject);
  return {
    whatsapp: `https://wa.me/${phone}?text=${encodedMsg}`,
    telegram: `https://t.me/${telegramUser}?text=${encodedMsg}`,
    mailto: `mailto:${email}?subject=${encodedSubj}&body=${encodedMsg}`,
  };
}
