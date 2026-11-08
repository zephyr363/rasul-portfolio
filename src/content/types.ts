/**
 * Доменные типы фазы 2 (REWRITE-ARCH).
 *
 * `LocaleCopy` — полный контракт видимых строк сайта. Источник RU-строк —
 * `.ai/previews/mockup-v2.html`; KZ/EN — `.ai/copy-mkt-1.md` + честный перевод
 * строк, появившихся только в mockup-v2. Никакого HTML внутри строк: заголовки
 * секций — единые строки вида «Кейсы — Примеры в работе.» (dim-часть отделяется
 * по « — » в `SectionHeading`).
 *
 * `CasesDocument` / `CaseItem` — контракт v1 документа кейсов
 * (`content/cases.json`), валидируется в `src/lib/cases.ts` через
 * `content/cases-contract.mjs`.
 */

export type Lang = "ru" | "kz" | "en";

/** SEO-мета: подставляется в <title> и meta[name=description] при смене языка. */
export interface MetaCopy {
  title: string;
  description: string;
}

/** Пункт таймлайна опыта. */
export interface ExperienceItem {
  date: string;
  org: string;
  role: string;
}

/** Тексты brief-формы контакта (два поля: имя + телефон). */
export interface ContactFormCopy {
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  nameError: string;
  phoneError: string;
  /** CTA формы: «Отправить заявку». */
  cta: string;
  /** Успех после 201 от API (заявка сохранена): «Заявка отправлена ✓». */
  success: string;
  /** Лейбл кнопки, пока идёт запрос: «Отправляем…». */
  sending: string;
  /** Сообщение при 400 (валидация на сервере не прошла). */
  submitError: string;
}

export interface LocaleCopy {
  lang: Lang;
  meta: MetaCopy;

  nav: {
    logo: string;
    /** Порядок: [Кейсы, Услуги, Обо мне, Опыт, Контакты]. */
    links: string[];
    cta: string;
  };

  hero: {
    /** Простое приветствие одной строкой, например «Привет, меня зовут Расул». */
    title: string;
    sub: string;
    lead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    photoAlt: string;
    /** Optional external HTTPS portrait for this language; blank uses the default. */
    photoUrl?: string;
  };

  cases: {
    /** Единый заголовок секции, например «Кейсы — Примеры в работе.». */
    heading: string;
  };

  services: {
    /** Единый заголовок секции, например «Услуги — Что я делаю.». */
    heading: string;
    intro: string;
    body: string;
    result: string;
    capabilitiesTitle: string;
    capabilities: string[];
  };

  about: {
    /** Единый заголовок секции, например «Обо мне — Кто я.». */
    heading: string;
    lead: string;
    body: string;
  };

  experience: {
    items: ExperienceItem[];
  };

  /**
   * Переход-строки между секциями (якорные ссылки «дальше» с ↓ в тексте).
   * Опционально: старые документы Firestore без этого блока остаются валидными —
   * фронтенд подставляет дефолтные тексты (см. `SectionNext`).
   */
  next?: {
    /** Hero → #about. */
    toAbout: string;
    /** «Обо мне» → #services. */
    toServices: string;
    /** «Услуги» → #cases. */
    toCases: string;
    /** «Кейсы» → #contact. */
    toContact: string;
  };

  contact: {
    /** Единый заголовок секции, например «Давайте приведём вам клиентов.». */
    heading: string;
    invite: string;
    telegramLabel: string;
    whatsappLabel: string;
    emailLabel: string;
    form: ContactFormCopy;
  };
}

/** Локализованные строки одного кейса (контракт v1). */
export interface CaseLocale {
  subtitle: string;
  meta?: string;
  title: string;
  desc?: string;
  metric?: string;
  btn?: string;
  kicker?: string;
  problem?: string;
  field?: string;
  bullets?: string[];
}

export interface CaseItem {
  type: "website" | "bot" | "ai";
  url?: string;
  previewImageUrl?: string;
  sourceId?: string;
  id: string;
  order: number;
  ru: CaseLocale;
  kz: CaseLocale;
  en: CaseLocale;
}

export interface CasesDocument {
  version: 1 | 2;
  cases: CaseItem[];
}
