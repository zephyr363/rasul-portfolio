import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import rawLocales from "../content/locales.json";
import rawCases from "../content/cases.json";

// Моки data-слоя и admin-слоёв: реальных Firebase/сетевых вызовов нет. AppRoutes
// тянет Site → @/data/*, AdminGate/LoginPage → @/admin/lib/auth, страницы
// Cases/Content → @/admin/lib/seed.
const mocks = vi.hoisted(() => ({
  getLocales: vi.fn(),
  getCases: vi.fn(),
  createLead: vi.fn(),
  getLeadsStream: vi.fn(() => () => {}),
  updateLeadStatus: vi.fn(() => Promise.resolve()),
  deleteLead: vi.fn(() => Promise.resolve()),
  describeLeadsError: vi.fn((e: unknown) => String(e)),
  onAuthChanged: vi.fn<(cb: (user: unknown | null) => void) => () => void>(() => () => {}),
  subscribeAdminAccess: vi.fn(),
  signOutUser: vi.fn(() => Promise.resolve()),
  signInGoogle: vi.fn(() => Promise.resolve(null)),
  sendEmailLink: vi.fn(() => Promise.resolve()),
  completeEmailLinkIfPresent: vi.fn(() => Promise.resolve(null)),
  seedLocalesIfEmpty: vi.fn(),
  seedCasesIfEmpty: vi.fn(),
  describeSeedError: vi.fn((e: unknown) => String(e)),
}));

vi.mock("@/data/content", () => ({ getLocales: mocks.getLocales }));
vi.mock("@/admin/lib/access", () => ({ subscribeAdminAccess: mocks.subscribeAdminAccess }));
vi.mock("@/data/cases", () => ({ getCases: mocks.getCases }));
vi.mock("@/data/leads", () => ({
  createLead: mocks.createLead,
  getLeadsStream: mocks.getLeadsStream,
  updateLeadStatus: mocks.updateLeadStatus,
  deleteLead: mocks.deleteLead,
  describeLeadsError: mocks.describeLeadsError,
}));
vi.mock("@/admin/lib/auth", () => ({
  onAuthChanged: mocks.onAuthChanged,
  signOutUser: mocks.signOutUser,
  signInGoogle: mocks.signInGoogle,
  sendEmailLink: mocks.sendEmailLink,
  completeEmailLinkIfPresent: mocks.completeEmailLinkIfPresent,
}));
vi.mock("@/admin/lib/seed", () => ({
  seedLocalesIfEmpty: mocks.seedLocalesIfEmpty,
  seedCasesIfEmpty: mocks.seedCasesIfEmpty,
  describeSeedError: mocks.describeSeedError,
}));

import { appRoutes } from "./App";

function renderAt(path: string) {
  return render(
    <RouterProvider router={createMemoryRouter(appRoutes, { initialEntries: [path] })} />,
  );
}

describe("Роутинг (AppRoutes)", () => {
  it("project basename preserves login redirect on a trailing-slash Pages route", async () => {
    mocks.onAuthChanged.mockImplementation((cb) => { cb(null); return () => {}; });
    const router = createMemoryRouter(appRoutes, {
      basename: "/rasul-portfolio/",
      initialEntries: ["/rasul-portfolio/admin/leads/"],
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole("button", { name: "Войти через Google" });
    expect(router.state.location.pathname).toBe("/rasul-portfolio/admin/login");
    router.dispose();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onAuthChanged.mockReturnValue(() => {});
    mocks.subscribeAdminAccess.mockImplementation((_uid, next) => { next(false); return () => {}; });
    mocks.getLocales.mockResolvedValue(JSON.parse(JSON.stringify(rawLocales)));
    mocks.getCases.mockResolvedValue(JSON.parse(JSON.stringify(rawCases.cases)));
  });

  it("/ → публичный сайт (hero)", async () => {
    renderAt("/");

    await screen.findByRole("heading", { level: 1, name: /Привет, меня зовут Расул/ });
    expect(screen.queryByRole("button", { name: "Войти через Google" })).toBeNull();
  });

  it("/admin (неавторизован) → AdminGate редиректит на /admin/login", async () => {
    mocks.onAuthChanged.mockImplementation((cb) => {
      cb(null);
      return () => {};
    });

    renderAt("/admin");

    // Гейт пускает на страницу входа, а не на сайт.
    await screen.findByRole("button", { name: "Войти через Google" });
    expect(screen.queryByRole("heading", { level: 1, name: /Привет, меня зовут/ })).toBeNull();
  });

  it("/admin/leads (владелец) → AdminLayout с разделами", async () => {
    mocks.subscribeAdminAccess.mockImplementation((_uid, next) => { next(true); return () => {}; });
    mocks.onAuthChanged.mockImplementation((cb) => {
      cb({ uid: "granted-owner-uid", email: "rasulakhmetov2004@gmail.com" });
      return () => {};
    });

    renderAt("/admin/leads");

    await screen.findByRole("heading", { name: "Заявки" });
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Разделы админ-панели" }),
    ).toBeInTheDocument();
    expect(mocks.subscribeAdminAccess).toHaveBeenCalledWith("granted-owner-uid", expect.any(Function), expect.any(Function));
  });

  it("/admin/leads waits for grant without rendering protected content", async () => {
    mocks.onAuthChanged.mockImplementation((cb) => { cb({ uid: "pending" }); return () => {}; });
    mocks.subscribeAdminAccess.mockImplementation(() => () => {});
    renderAt("/admin/leads");
    expect(await screen.findByText(/Проверка доступа/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Заявки" })).toBeNull();
  });
  it("/admin/leads denies missing or disabled grant", async () => {
    mocks.onAuthChanged.mockImplementation((cb) => { cb({ uid: "denied" }); return () => {}; });
    renderAt("/admin/leads");
    expect(await screen.findByRole("alert")).toHaveTextContent("не предоставлен");
    expect(screen.queryByRole("heading", { name: "Заявки" })).toBeNull();
  });
  it("/admin/leads surfaces access errors, never protected content", async () => {
    mocks.onAuthChanged.mockImplementation((cb) => { cb({ uid: "error" }); return () => {}; });
    mocks.subscribeAdminAccess.mockImplementation((_uid, _next, error) => { error(new Error("offline")); return () => {}; });
    renderAt("/admin/leads");
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось проверить");
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Заявки" })).toBeNull();
  });
  it("unknown routes redirect to the public site", async () => {
    renderAt("/missing-route");
    await screen.findByRole("heading", { level: 1, name: /Привет, меня зовут Расул/ });
  });
  it("admin index preserves the leads redirect", async () => {
    mocks.subscribeAdminAccess.mockImplementation((_uid, next) => { next(true); return () => {}; });
    mocks.onAuthChanged.mockImplementation((cb) => { cb({ uid: "owner", email: "owner@example.com" }); return () => {}; });
    renderAt("/admin");
    expect(await screen.findByRole("heading", { name: "Заявки" })).toBeInTheDocument();
  });
});
