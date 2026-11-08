import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CaseItem, Lang, LocaleCopy } from "@/content/types";
import { getCaseLocale } from "@/lib/cases";

import rawLocales from "../content/locales.json";
import rawCases from "../content/cases.json";

import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { appRoutes } from "./App";

function App() {
  return <RouterProvider router={createMemoryRouter(appRoutes, { initialEntries: ["/"] })} />;
}

/**
 * Интеграционные тесты каркаса (FB-T4). Контент и кейсы приходят из Firestore
 * через data-слой — здесь data-слой мокируется, реальных сетевых вызовов нет.
 * Проверяем: loading → success, error + retry, секции, порядок кейсов, локали,
 * сохранение языка, title/meta.
 */

type ContentDoc = { version: 1; locales: Record<Lang, LocaleCopy> };

// Моки data-слоя: App → lib/locales·cases → data/*; Contact → data/leads.
const mocks = vi.hoisted(() => ({
  getLocales: vi.fn(),
  getCases: vi.fn(),
  createLead: vi.fn(),
}));

vi.mock("@/data/content", () => ({ getLocales: mocks.getLocales }));
vi.mock("@/data/cases", () => ({ getCases: mocks.getCases }));
vi.mock("@/data/leads", () => ({ createLead: mocks.createLead }));

const STORAGE_KEY = "rasul-language";

/** Глубокая копия документа локалей — как его отдаёт Firestore-адаптер. */
function contentFixture(): ContentDoc {
  return JSON.parse(JSON.stringify(rawLocales)) as ContentDoc;
}

/** Кейсы, отсортированные по order — как их отдаёт data-слой. */
function casesFixture(): CaseItem[] {
  const cases = JSON.parse(JSON.stringify(rawCases.cases)) as CaseItem[];
  return cases.sort((a, b) => a.order - b.order);
}

/** Языковые маркеры: по 2–3 строки на локаль (hero-title, CTA, заголовок кейсов). */
const MARKERS = {
  ru: {
    hero: /Привет, меня зовут Расул/,
    cta: /Написать в Telegram/,
    casesHeading: /Кейсы — Примеры в работе/,
    htmlLang: "ru",
  },
  kz: {
    hero: /Сәлем, менің атым Расул/,
    cta: /Telegram-ға жазу/,
    casesHeading: /Кейстер — Іс жүзіндегі мысалдар/,
    htmlLang: "kk",
  },
  en: {
    hero: /Hi, my name is Rasul/,
    cta: /Message on Telegram/,
    casesHeading: /Case Studies — Work in action/,
    htmlLang: "en",
  },
} as const;

/** Рендерит App и дожидается готовности контента (появление hero h1). */
async function renderApp() {
  render(<App />);
  await screen.findByRole("heading", { level: 1 });
}

/** Кнопка-триггер дропдауна языка (доступное имя — текущий язык RU/KZ/EN). */
function langTrigger() {
  return screen.getByRole("button", { name: /^(RU|KZ|EN)$/ });
}

/** Открывает дропдаун языка (ArrowDown) и выбирает пункт. */
async function switchLanguage(label: "RU" | "KZ" | "EN") {
  fireEvent.keyDown(langTrigger(), { key: "ArrowDown" });
  const item = await screen.findByRole("menuitem", { name: label });
  fireEvent.click(item);
}

function expectMarkers(lang: keyof typeof MARKERS) {
  const marker = MARKERS[lang];

  expect(screen.getByRole("heading", { level: 1, name: marker.hero })).toBeInTheDocument();
   expect(screen.queryByRole("link", { name: marker.cta })).toBeNull();
  expect(screen.getByRole("heading", { level: 2, name: marker.casesHeading })).toBeInTheDocument();

  expect(document.documentElement.lang).toBe(marker.htmlLang);
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "";

  mocks.getLocales.mockReset();
  mocks.getCases.mockReset();
  mocks.createLead.mockReset();

  mocks.getLocales.mockResolvedValue(contentFixture());
  mocks.getCases.mockResolvedValue(casesFixture());
  mocks.createLead.mockResolvedValue("lead-1");
});

describe("App: загрузка данных", () => {
  it("показывает skeleton-экран, пока контент грузится, и рендерит сайт после", async () => {
    let resolveLocales!: (value: ContentDoc) => void;
    mocks.getLocales.mockReturnValue(
      new Promise<ContentDoc>((resolve) => {
        resolveLocales = resolve;
      }),
    );
    mocks.getCases.mockResolvedValue(casesFixture());

    render(<App />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();

    resolveLocales(contentFixture());
    await screen.findByRole("heading", { level: 1, name: MARKERS.ru.hero });
  });

  it("показывает экран ошибки с понятным текстом и кнопкой «Повторить»", async () => {
    mocks.getLocales.mockRejectedValueOnce(new Error("permission-denied"));
    mocks.getCases.mockResolvedValue(casesFixture());

    render(<App />);

    await screen.findByText(/Не удалось загрузить данные. Проверьте подключение/);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: MARKERS.ru.hero })).toBeNull();
  });

  it("повторяет загрузку по кнопке «Повторить» и рендерит сайт", async () => {
    mocks.getLocales.mockRejectedValueOnce(new Error("permission-denied"));
    mocks.getCases.mockResolvedValue(casesFixture());

    render(<App />);
    await screen.findByRole("button", { name: "Повторить" });

    mocks.getLocales.mockResolvedValueOnce(contentFixture());
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));

    await screen.findByRole("heading", { level: 1, name: MARKERS.ru.hero });
    expect(mocks.getLocales).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(mocks.getCases).toHaveBeenLastCalledWith({ forceRefresh: true });
  });

  it("без JSON-fallback: ошибка кейсов тоже приводит к экрану ошибки", async () => {
    mocks.getLocales.mockResolvedValue(contentFixture());
    mocks.getCases.mockRejectedValueOnce(new Error("unavailable"));

    render(<App />);

    await screen.findByText(/Не удалось загрузить данные. Проверьте подключение/);
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});

describe("App: структура страницы", () => {
  it("рендерит hero + 4 секции и держит порядок Hero → About → Services → Cases → Contact", async () => {
    await renderApp();

    const main = document.querySelector("main");
    expect(main).not.toBeNull();

    const sections = Array.from(main!.querySelectorAll("section"));
    expect(sections).toHaveLength(5);

    // Первая секция — hero без id, в ней единственный h1 страницы.
    expect(sections[0]).not.toHaveAttribute("id");
    expect(within(sections[0] as HTMLElement).getByRole("heading", { level: 1 })).toBeInTheDocument();
    const hero = within(sections[0] as HTMLElement);
    expect(hero.queryByRole("button")).toBeNull();
    expect(hero.getAllByRole("link")).toHaveLength(1);
    expect(hero.getByRole("link")).toHaveAttribute("href", "#about");

    const sectionIds = sections
      .slice(1)
      .map((section) => section.getAttribute("id"));
    expect(sectionIds).toEqual(["about", "services", "cases", "contact"]);
  });

  it("рендерит якоря навигации (включая legacy-алиасы #projects/#expertise)", async () => {
    await renderApp();

    for (const id of ["cases", "services", "about", "experience", "contact"]) {
      expect(document.getElementById(id)).toBeInTheDocument();
    }

    expect(document.getElementById("projects")).toBeInTheDocument();
    expect(document.getElementById("expertise")).toBeInTheDocument();
  });

  it("рендерит Header вокруг main, Footer отсутствует", async () => {
    await renderApp();

    expect(document.querySelector("header")).toBeInTheDocument();
    expect(document.querySelector("footer")).toBeNull();
    expect(document.getElementById("top")).toBeInTheDocument();
  });

  it("не рендерит eyebrow и badge на фото hero", async () => {
    await renderApp();

    expect(screen.queryByText(/Приветствие · Астана/)).toBeNull();
    expect(screen.queryByText(/Отвечаю быстро · 2 часа/)).toBeNull();
  });
});

describe("App: кейсы", () => {
  it("рендерит 3 кейса из Firestore в порядке order", async () => {
    await renderApp();

    const casesSection = document.getElementById("cases");
    expect(casesSection).not.toBeNull();

    const cards = within(casesSection as HTMLElement).getAllByRole("article");
    expect(cards).toHaveLength(3);

    const list = casesFixture();
    const expected = list.map((item) => getCaseLocale(item, "ru"));
    expected.forEach((loc, index) => {
      expect(cards[index]).toHaveTextContent(loc.title);
      expect(cards[index]).toHaveTextContent(loc.subtitle);
    });

    // Порядок в DOM = порядок по `order` (1..3), а не порядок в JSON.
    expect(list.map((item) => item.id)).toEqual([
      "parcel-status",
      "access-control",
      "notifications",
    ]);
  });

  it("переводит названия кейсов вместе с языком", async () => {
    window.localStorage.setItem(STORAGE_KEY, "en");
    await renderApp();

    const casesSection = document.getElementById("cases") as HTMLElement;
    expect(within(casesSection).getByText("Faster parcel status handling")).toBeInTheDocument();
    expect(within(casesSection).getByText("Secure sign-in and role-based access")).toBeInTheDocument();
    expect(within(casesSection).getByText("Notifications that never get lost")).toBeInTheDocument();

    expect(within(casesSection).queryByText("Быстрее обработка статусов посылок")).toBeNull();
  });
});

describe("App: переключение языка", () => {
  it("RU → KZ → EN меняет маркеры, html lang и триггер дропдауна", async () => {
    await renderApp();

    expectMarkers("ru");
    expect(langTrigger()).toHaveTextContent("RU");

    await switchLanguage("KZ");
    expectMarkers("kz");
    expect(langTrigger()).toHaveTextContent("KZ");
    // Прошлая локаль действительно ушла, а не просто добавилась.
    expect(screen.queryByRole("heading", { name: /Примеры в работе/ })).toBeNull();

    await switchLanguage("EN");
    expectMarkers("en");
    expect(langTrigger()).toHaveTextContent("EN");
    expect(screen.queryByRole("heading", { name: /Іс жүзіндегі/ })).toBeNull();
  });

  it("сохраняет выбор в localStorage и восстанавливает его при повторном рендере", async () => {
    const { unmount } = render(<App />);
    await screen.findByRole("heading", { level: 1, name: MARKERS.ru.hero });

    await switchLanguage("KZ");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("kz");

    unmount();
    await renderApp();

    expectMarkers("kz");
    expect(langTrigger()).toHaveTextContent("KZ");
  });

  it("восстанавливает язык из localStorage при первом рендере", async () => {
    window.localStorage.setItem(STORAGE_KEY, "en");
    await renderApp();

    expectMarkers("en");
    expect(langTrigger()).toHaveTextContent("EN");
  });

  it("откатывается на RU при пустом или невалидном значении в localStorage", async () => {
    window.localStorage.setItem(STORAGE_KEY, "fr");
    await renderApp();

    expectMarkers("ru");
    expect(langTrigger()).toHaveTextContent("RU");
  });

  it("обновляет title и meta description под локаль", async () => {
    await renderApp();
    expect(document.title).toContain("Расул Ахметов");

    await switchLanguage("EN");
    expect(document.title).toBe(
      "Rasul Akhmetov — websites, Telegram bots, and AI agents for business",
    );

    const meta = document.querySelector('meta[name="description"]');
    // В jsdom index.html не подключён — meta может отсутствовать; тогда проверяем
    // только title. Если meta есть, она обязана обновиться.
    if (meta) {
      expect(meta.getAttribute("content")).toContain("Rasul Akhmetov");
    }
  });
});

describe("App: тема", () => {
  it("переключает data-theme light ↔ dark и сохраняет выбор в localStorage", async () => {
    await renderApp();

    // По умолчанию — системная; в jsdom matchMedia отсутствует → light.
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Сменить тему" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("rasul-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Сменить тему" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("rasul-theme")).toBe("light");
  });

  it("восстанавливает тему из localStorage при первом рендере", async () => {
    window.localStorage.setItem("rasul-theme", "dark");
    await renderApp();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("App: переход-строки и отсутствие лого/CV", () => {
  it("рендерит переход-строки к следующим секциям", async () => {
    await renderApp();

    const transitions = [
      { href: "#about", text: /Кто я и чем помогу вам/ },
      { href: "#services", text: /Что я могу сделать для вашего бизнеса/ },
      { href: "#cases", text: /Как это работает на деле/ },
      { href: "#contact", text: /Обсудим вашу задачу/ },
    ];

    for (const { href, text } of transitions) {
      expect(screen.getByRole("link", { name: text })).toHaveAttribute("href", href);
    }
  });

  it("не рендерит логотип «Расул Ахметов» и кнопку CV в шапке", async () => {
    await renderApp();

    expect(screen.queryByRole("link", { name: /Расул Ахметов/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "CV" })).toBeNull();
  });
});
