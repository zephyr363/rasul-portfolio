import { Component, lazy, Suspense, useState, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, type RouteObject } from "react-router-dom";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/lib/theme";
import Site from "@/Site";

class ChunkErrorBoundary extends Component<{ children: ReactNode; retry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div role="alert" className="space-y-4 p-6">
      <p>Не удалось загрузить раздел. Проверьте соединение и повторите попытку.</p>
      <Button onClick={this.props.retry}>Повторить загрузку</Button>
      <Button variant="outline" onClick={() => window.location.reload()}>Обновить страницу</Button>
    </div>;
    return this.props.children;
  }
}

type RouteLoader = () => Promise<{ default: ComponentType }>;
// A suspended, not-yet-committed render can lose its hook memo. Keep lazy's
// promise/status outside that render so concurrent retries use the same type.
// Weak keys avoid retaining loaders; production has only the six below.
const lazyPages = new WeakMap<RouteLoader, ReturnType<typeof lazy<ComponentType>>>();

function LazyRoute({ load }: { load: RouteLoader }) {
  const [attempt, setAttempt] = useState(0);
  let Page = lazyPages.get(load);
  if (!Page) { Page = lazy(load); lazyPages.set(load, Page); }
  function retry() {
    // Only an explicit retry clears lazy's cached rejection, never a render.
    lazyPages.delete(load);
    setAttempt((value) => value + 1);
  }
  return <ChunkErrorBoundary key={attempt} retry={retry}>
    <Suspense fallback={<LoadingScreen label="Загрузка раздела…" />}><Page /></Suspense>
  </ChunkErrorBoundary>;
}

const loadGate = () => import("@/admin/AdminGate").then((module) => ({ default: module.AdminGate }));
const loadLogin = () => import("@/admin/LoginPage").then((module) => ({ default: module.LoginPage }));
const loadLeads = () => import("@/admin/pages/LeadsPage").then((module) => ({ default: module.LeadsPage }));
const loadCases = () => import("@/admin/pages/CasesPage").then((module) => ({ default: module.CasesPage }));
const loadContent = () => import("@/admin/pages/ContentPage").then((module) => ({ default: module.ContentPage }));
const loadSettings = () => import("@/admin/pages/SettingsPage").then((module) => ({ default: module.SettingsPage }));

/** Shared by production and createMemoryRouter tests. */
export const appRoutes: RouteObject[] = [{
  element: <ThemeProvider><Outlet /></ThemeProvider>,
  children: [
    { path: "/", element: <Site /> },
    { path: "/admin/login", element: <LazyRoute load={loadLogin} /> },
    { path: "/admin", element: <LazyRoute load={loadGate} />, children: [
      { index: true, element: <Navigate to="leads" replace /> },
      { path: "leads", element: <LazyRoute load={loadLeads} /> },
      { path: "cases", element: <LazyRoute load={loadCases} /> },
      { path: "content", element: <LazyRoute load={loadContent} /> },
      { path: "settings", element: <LazyRoute load={loadSettings} /> },
    ] },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
}];

let browserRouter: ReturnType<typeof createBrowserRouter> | undefined;
export default function App() {
  browserRouter ??= createBrowserRouter(appRoutes, { basename: import.meta.env.BASE_URL });
  return <RouterProvider router={browserRouter} />;
}
