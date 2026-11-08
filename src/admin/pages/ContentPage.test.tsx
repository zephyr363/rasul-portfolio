import { act, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import raw from "../../../content/locales.json";
import type { ContentDoc } from "@/data/content";

const mocks = vi.hoisted(() => ({
  getLocales: vi.fn(),
  saveLocales: vi.fn(),
  seedLocalesIfEmpty: vi.fn(),
  describeSeedError: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
  initializeApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  getFirestore: vi.fn(() => ({})),
  getAuth: vi.fn(() => ({})),
  setPersistence: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(),
  doc: vi.fn(() => ({ path: "siteContent/locales" })),
  setDoc: vi.fn(),
}));

vi.mock("firebase/app", () => ({ initializeApp: mocks.initializeApp }));
vi.mock("firebase/firestore", () => ({
  getFirestore: mocks.getFirestore,
  getDoc: mocks.getDoc,
  doc: mocks.doc,
  setDoc: mocks.setDoc,
}));
vi.mock("firebase/auth", () => ({
  getAuth: mocks.getAuth,
  setPersistence: mocks.setPersistence,
  browserLocalPersistence: "LOCAL",
}));
vi.mock("@/admin/lib/seed", () => ({
  seedLocalesIfEmpty: mocks.seedLocalesIfEmpty,
  describeSeedError: mocks.describeSeedError,
}));
// Сохраняем РЕАЛЬНЫЕ validateContentDoc / describeContentError (контракт v2),
// мокируем только сетевые getLocales / saveLocales.
vi.mock("@/data/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/content")>();
  return {
    ...actual,
    getLocales: mocks.getLocales,
    saveLocales: mocks.saveLocales,
  };
});

import { ContentPage } from "./ContentPage";

function render(page: ReactElement) {
  return rtlRender(<RouterProvider router={createMemoryRouter([{ path: "/", element: page }])} />);
}

function validDoc(): ContentDoc {
  return JSON.parse(JSON.stringify(raw)) as ContentDoc;
}

describe("ContentPage", () => {
  it("keeps section labels unshrunk in the horizontally scrollable mobile navigation", async () => {
    render(<ContentPage />);
    await screen.findByRole("button", { name: "Hero" });
    const nav = screen.getByRole("navigation", { name: "Секции контента" });
    expect(nav).toHaveClass("min-w-0", "overflow-x-auto", "gap-1", "min-[700px]:w-52", "min-[700px]:flex-col");
    for (const button of nav.querySelectorAll("button")) {
      expect(button).toHaveClass("shrink-0", "whitespace-nowrap", "px-3", "min-h-11");
    }
  });
  it("debounces normalized photo URLs, hides invalid input and cancels old-language timers", async () => {
    render(<ContentPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Hero" }));
    vi.useFakeTimers();
    try {
      const input = screen.getByLabelText("HTTPS URL фото — RU");
      fireEvent.change(input, { target: { value: "https://example.com/one.jpg" } });
      act(() => vi.advanceTimersByTime(200));
      fireEvent.change(input, { target: { value: "https://EXAMPLE.com/two.jpg" } });
      act(() => vi.advanceTimersByTime(299));
      expect(screen.queryByAltText(/Предпросмотр:/)).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByAltText(/Предпросмотр:/)).toHaveAttribute("src", "https://example.com/two.jpg");
      expect(input).toHaveValue("https://EXAMPLE.com/two.jpg");
      fireEvent.change(input, { target: { value: "http://invalid.example/photo.jpg" } });
      expect(screen.queryByAltText(/Предпросмотр:/)).not.toBeInTheDocument();
      fireEvent.change(input, { target: { value: "https://example.com/old-language.jpg" } });
      fireEvent.click(screen.getByRole("button", { name: "KZ" }));
      expect(screen.queryByAltText(/Предпросмотр:/)).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(300));
      expect(screen.getByAltText(/Предпросмотр:/)).not.toHaveAttribute("src", "https://example.com/old-language.jpg");
    } finally { vi.useRealTimers(); }
  });
  it("disables experience mutations while saving", async () => {
    let finish!: () => void;
    mocks.saveLocales.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<ContentPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Опыт" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(screen.getByRole("button", { name: "Добавить опыт" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Удалить опыт 1 — RU" })).toBeDisabled();
    finish();
    await screen.findByText("Сохранено ✓");
  });
  it("adds, validates, edits, deletes and cancels experience independently per locale", async () => {
    render(<ContentPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Опыт" }));
    fireEvent.click(screen.getByRole("button", { name: "Добавить опыт" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(mocks.saveLocales).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText("Период")[2]).toHaveAttribute("aria-invalid", "true");
    for (const [label, value] of [["Период", "2026"], ["Организация", "New org"], ["Роль", "New role"]]) {
      fireEvent.change(screen.getAllByLabelText(label)[2], { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Удалить опыт 1 — RU" }));
    expect(screen.getAllByLabelText("Организация")[1]).toHaveValue("New org");
    fireEvent.click(screen.getByRole("button", { name: "KZ" }));
    expect(screen.getAllByLabelText("Организация")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getAllByLabelText("Организация")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "RU" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(mocks.saveLocales).toHaveBeenCalledTimes(1));
    const saved = mocks.saveLocales.mock.calls[0][0] as ContentDoc;
    expect(saved.locales.ru.experience.items[1].org).toBe("New org");
    expect(saved.locales.kz).toEqual(validDoc().locales.kz);
    expect(saved.locales.en).toEqual(validDoc().locales.en);
    fireEvent.click(screen.getByRole("button", { name: "Удалить опыт 1 — RU" }));
    fireEvent.click(screen.getByRole("button", { name: "Отменить правки" }));
    expect(screen.getAllByLabelText("Организация")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Удалить опыт 1 — RU" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить опыт 1 — RU" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(mocks.saveLocales).toHaveBeenCalledTimes(2));
    expect(mocks.saveLocales.mock.calls[1][0].locales.ru.experience.items).toEqual([]);
  });
  it("explains external-only photo replacement without an upload control", async () => {
    const { container } = render(<ContentPage />);
    await screen.findByRole("button", { name: "Hero" });
    expect(screen.getByText(/В секции Hero укажите HTTPS-ссылку/)).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Обновить фото" })).not.toBeInTheDocument();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLocales.mockResolvedValue(validDoc());
    mocks.saveLocales.mockResolvedValue(undefined);
  });

  it("loads a legacy URL as blank, cancels and saves per-language photo edits", async () => {
    render(<ContentPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Hero" }));
    const input = screen.getByLabelText("HTTPS URL фото — RU");
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { value: "https://example.com/portrait.jpg" } });
    await waitFor(() => expect(screen.getByAltText(/Предпросмотр:/)).toHaveAttribute("src", "https://example.com/portrait.jpg"));
    fireEvent.click(screen.getByRole("button", { name: "Отменить правки" }));
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { value: "https://example.com/portrait.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(mocks.saveLocales).toHaveBeenCalledTimes(1));
    const doc = mocks.saveLocales.mock.calls[0][0] as ContentDoc;
    expect(doc.locales.ru.hero.photoUrl).toBe("https://example.com/portrait.jpg");
    expect(doc.locales.kz.hero.photoUrl).toBeUndefined();
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,AA", "/photo.jpg", "http://example.com/photo.jpg"])("rejects unsafe photo URL %s before saving", async (url) => {
    render(<ContentPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Hero" }));
    fireEvent.change(screen.getByLabelText("HTTPS URL фото — RU"), { target: { value: url } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(mocks.saveLocales).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/валидации/);
    expect(screen.queryByAltText(/Предпросмотр:/)).not.toBeInTheDocument();
  });

  it("правка заголовка Hero → saveLocales с обновлённым документом", async () => {
    render(<ContentPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Hero" }));

    const title = screen.getByLabelText("Заголовок");
    fireEvent.change(title, { target: { value: "Новый заголовок" } });

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(mocks.saveLocales).toHaveBeenCalledTimes(1);
    });
    const doc = mocks.saveLocales.mock.calls[0][0] as ContentDoc;
    expect(doc.locales.ru.hero.title).toBe("Новый заголовок");
    // Другие локали и поля не тронуты.
    expect(doc.locales.kz.hero.title).toBe("Сәлем, менің атым Расул");
    expect(doc.version).toBe(1);
  });

  it("валидация пустого заголовка → ошибка без записи", async () => {
    render(<ContentPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Hero" }));

    const title = screen.getByLabelText("Заголовок");
    fireEvent.change(title, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/валидации/);
    });
    expect(mocks.saveLocales).not.toHaveBeenCalled();
  });

  it("переключение языков не теряет черновик", async () => {
    render(<ContentPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Hero" }));

    const title = screen.getByLabelText("Заголовок");
    fireEvent.change(title, { target: { value: "RU draft" } });

    // Переключаемся на KZ, затем обратно на RU — черновик RU сохраняется.
    fireEvent.click(screen.getByRole("button", { name: "KZ" }));
    fireEvent.click(screen.getByRole("button", { name: "RU" }));

    expect(screen.getByLabelText("Заголовок")).toHaveValue("RU draft");
  });
});

