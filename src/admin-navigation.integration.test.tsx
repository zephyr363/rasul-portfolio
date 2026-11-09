import { cloneElement, StrictMode, type ReactElement, type ComponentType } from "react";
import type { User } from "firebase/auth";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createBrowserRouter, createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rawLocales from "../content/locales.json";
import rawCases from "../content/cases.json";

// Only external auth/access/data boundaries are replaced. Routes, lazy imports,
// Gate, Login, Layout, navigation protection and all four pages are real.
const external = vi.hoisted(() => ({
  user: null as User | null,
  listeners: new Set<(user: User | null) => void>(),
  grants: new Set<(allowed: boolean) => void>(),
  allowed: true,
  autoGrant: true,
  popup: vi.fn<() => Promise<User | null>>(),
  getLocales: vi.fn(),
  getCases: vi.fn(),
  stopLeads: vi.fn(),
  write: vi.fn(() => { throw new Error("Unexpected write in read-only navigation test"); }),
}));

vi.mock("@/lib/firebase", () => ({
  auth: { get currentUser() { return external.user; } }, db: {},
}));
vi.mock("@/admin/lib/auth", () => ({
  onAuthChanged: (callback: (user: User | null) => void) => {
    external.listeners.add(callback);
    callback(external.user);
    return () => { external.listeners.delete(callback); };
  },
  signInGoogle: external.popup,
  completeEmailLinkIfPresent: async () => null,
  sendEmailLink: external.write,
  signOutUser: external.write,
  describeAuthState: async () => "test session",
}));
vi.mock("@/admin/lib/access", () => ({
  subscribeAdminAccess: (_uid: string, next: (allowed: boolean) => void) => {
    external.grants.add(next);
    if (external.autoGrant) next(external.allowed);
    return () => { external.grants.delete(next); };
  },
}));
vi.mock("@/data/content", () => ({
  getLocales: external.getLocales,
  saveLocales: external.write,
  validateContentDoc: () => [],
  describeContentError: String,
  invalidateLocalesCache: vi.fn(),
}));
vi.mock("@/data/cases", () => ({
  getCases: external.getCases,
  saveCases: external.write,
  describeCasesError: String,
  invalidateCasesCache: vi.fn(),
}));
vi.mock("@/data/leads", () => ({
  getLeadsStream: (_filters: unknown, next: (leads: unknown[]) => void) => {
    next([]);
    return external.stopLeads;
  },
  createLead: external.write,
  updateLeadStatus: external.write,
  deleteLead: external.write,
  describeLeadsError: String,
}));

import { appRoutes } from "./App";

const owner = { uid: "navigation-owner", email: "owner@example.com", providerData: [{ providerId: "google.com" }] } as User;
const base = "/rasul-portfolio/";
const pages = [
  { path: "settings", heading: "Настройки" },
  { path: "leads", heading: "Заявки" },
  { path: "cases", heading: "Кейсы" },
  { path: "content", heading: "Контент" },
] as const;
type Router = ReturnType<typeof createMemoryRouter>;
let router: Router;

function mount(path = "admin", browser = false) {
  const url = `${base}${path}`;
  if (browser) window.history.replaceState(null, "", url);
  router = browser
    ? createBrowserRouter(appRoutes, { basename: base })
    : createMemoryRouter(appRoutes, { basename: base, initialEntries: [url] });
  render(<StrictMode><RouterProvider router={router} /></StrictMode>);
}

async function expectPage(page: typeof pages[number]) {
  // Real lazy imports can exceed RTL's 1s default under the parallel release suite.
  await screen.findByRole("heading", { level: 1, name: page.heading }, { timeout: 5_000 });
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(`${base}admin/${page.path}`);
    for (const other of pages.filter((item) => item !== page)) {
      expect(screen.queryByRole("heading", { level: 1, name: other.heading })).not.toBeInTheDocument();
    }
  });
  expect(screen.queryByRole("heading", { name: "Вход для владельца" })).not.toBeInTheDocument();
  const nav = screen.getByRole("navigation", { name: "Разделы админ-панели" });
  expect(within(nav).getByRole("link", { name: page.heading })).toHaveAttribute("aria-current", "page");
}

async function clickPage(page: typeof pages[number]) {
  const nav = screen.getByRole("navigation", { name: "Разделы админ-панели" });
  fireEvent.click(within(nav).getByRole("link", { name: page.heading }));
  await expectPage(page);
}

beforeEach(() => {
  vi.clearAllMocks();
  external.user = null;
  external.listeners.clear();
  external.grants.clear();
  external.allowed = true;
  external.autoGrant = true;
  external.popup.mockResolvedValue(null);
  external.getLocales.mockImplementation(async () => structuredClone(rawLocales));
  external.getCases.mockImplementation(async () => structuredClone(rawCases.cases));
});

afterEach(() => {
  router?.dispose();
  window.history.replaceState(null, "", "/");
  expect(external.write).not.toHaveBeenCalled();
});

describe("production admin route tree / StrictMode / Pages basename", () => {
  it("commits the login → Gate → Leads transition after a deferred cold chunk without restarting its loader", async () => {
    let releaseGate!: () => void;
    const network = new Promise<void>((resolve) => { releaseGate = resolve; });
    const adminRoute = appRoutes[0].children!.find((route) => route.path === "/admin")!;
    type LazyProps = { load: () => Promise<{ default: ComponentType }> };
    const element = adminRoute.element as ReactElement<LazyProps>;
    const load = vi.fn(() => network.then(element.props.load));
    const routes = [{ ...appRoutes[0], children: appRoutes[0].children!.map((route) =>
      route === adminRoute ? { ...route, element: cloneElement(element, { load }) } : route,
    ) }] as RouteObject[];
    router = createMemoryRouter(routes, { basename: base, initialEntries: [`${base}admin/login`] });
    render(<StrictMode><RouterProvider router={router} /></StrictMode>);
    const login = await screen.findByRole("button", { name: "Войти через Google" });
    external.popup.mockImplementation(async () => { external.user = owner; return owner; });
    fireEvent.click(login);
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(router.state.location.pathname).toBe(`${base}admin/leads`);
    // Let the cold module resolve outside act: concurrent Suspense retries must
    // retain the lazy identity even when the route has never committed.
    releaseGate();
    await expectPage(pages[1]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("commits Leads → Cases after a deferred cold page chunk without restarting its loader", async () => {
    external.user = owner;
    let releaseCases!: () => void;
    const network = new Promise<void>((resolve) => { releaseCases = resolve; });
    const adminRoute = appRoutes[0].children!.find((route) => route.path === "/admin")!;
    const casesRoute = adminRoute.children!.find((route) => route.path === "cases")!;
    type LazyProps = { load: () => Promise<{ default: ComponentType }> };
    const element = casesRoute.element as ReactElement<LazyProps>;
    const load = vi.fn(() => network.then(element.props.load));
    const routes = [{ ...appRoutes[0], children: appRoutes[0].children!.map((route) =>
      route === adminRoute ? { ...route, children: route.children!.map((child) =>
        child === casesRoute ? { ...child, element: cloneElement(element, { load }) } : child,
      ) } : route,
    ) }] as RouteObject[];
    router = createMemoryRouter(routes, { basename: base, initialEntries: [`${base}admin/leads`] });
    render(<StrictMode><RouterProvider router={router} /></StrictMode>);
    await expectPage(pages[1]);

    const nav = screen.getByRole("navigation", { name: "Разделы админ-панели" });
    fireEvent.click(within(nav).getByRole("link", { name: "Кейсы" }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe(`${base}admin/cases`);
    expect(screen.queryByRole("heading", { level: 1, name: "Кейсы" })).not.toBeInTheDocument();

    // Cases has never committed when its first render suspends. Resolving the
    // chunk outside act catches a lazy identity recreated by the render retry.
    releaseCases();
    await expectPage(pages[2]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it.each(["popup result", "auth notification"])("anonymous /admin → visible login → %s → access grant → Leads", async (source) => {
    mount();
    const login = await screen.findByRole("button", { name: "Войти через Google" });
    expect(screen.getByRole("heading", { name: "Вход для владельца" })).toBeVisible();
    expect(router.state.location.pathname).toBe(`${base}admin/login`);
    external.autoGrant = false;
    if (source === "popup result") {
      external.popup.mockImplementation(async () => { external.user = owner; return owner; });
      fireEvent.click(login);
    } else {
      // Observer delivery also covers restored sessions/email-link completion.
      act(() => {
        external.user = owner;
        for (const notify of [...external.listeners]) notify(owner);
      });
    }
    await screen.findByText("Проверка доступа…");
    expect(screen.queryByRole("heading", { name: "Заявки" })).not.toBeInTheDocument();
    await waitFor(() => expect(external.grants.size).toBe(1));
    act(() => { for (const grant of external.grants) grant(true); });
    await expectPage(pages[1]);
  });

  it("all real sidebar links switch URL AND unique page in both directions, then Back/Forward", async () => {
    external.user = owner;
    mount();
    await expectPage(pages[1]);
    // All directed pairs: catches retained outlet/previous heading and guards
    // left registered by Content/Cases, including repeated cached lazy imports.
    for (const from of pages) {
      await clickPage(from);
      for (const to of pages.filter((page) => page !== from)) {
        await clickPage(to);
        await clickPage(from);
      }
    }
    await clickPage(pages[0]);
    await clickPage(pages[1]);
    act(() => { void router.navigate(-1); });
    await expectPage(pages[0]);
    act(() => { void router.navigate(1); });
    await expectPage(pages[1]);
    expect(external.stopLeads).toHaveBeenCalled();
    expect(external.getLocales).toHaveBeenCalledWith({ forceRefresh: true });
    expect(external.getCases).toHaveBeenCalledWith({ forceRefresh: true });
    expect(external.listeners.size).toBe(1);
    expect(external.grants.size).toBe(1);
  }, 20_000);

  it("browser history and basename retain visible lazy pages after native Back/Forward", async () => {
    external.user = owner;
    mount("admin/leads/", true);
    await screen.findByRole("heading", { name: "Заявки" });
    await clickPage(pages[0]);
    expect(window.location.pathname).toBe(`${base}admin/settings`);
    await clickPage(pages[3]);
    act(() => window.history.back());
    await expectPage(pages[0]);
    expect(window.location.pathname).toBe(`${base}admin/settings`);
    act(() => window.history.forward());
    await expectPage(pages[3]);
    expect(window.location.pathname).toBe(`${base}admin/content`);
  });
});
