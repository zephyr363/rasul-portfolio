import { useRef } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  Link,
  useLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import { Provider } from "react-redux";
import { MotionConfig } from "motion/react";
import { makeStore, type AppStore } from "~/app/store";
import { serverApi } from "~/shared/api/server";
import type { Site } from "~/shared/types";
import { Shell } from "~/widgets/shell";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource-variable/source-sans-3";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/cyrillic-400.css";
import "./styles.css";

export async function loader() {
  return { site: await serverApi<Site>("site/") };
}
export const meta: Route.MetaFunction = ({ loaderData: data }) =>
  data
    ? [
        {
          name: "google-site-verification",
          content: data.site.google_verification,
        },
        { name: "msvalidate.01", content: data.site.bing_verification },
      ]
    : [];
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAFAF8" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export default function App() {
  const { site } = useLoaderData<typeof loader>();
  const ref = useRef<AppStore | null>(null);
  if (!ref.current) ref.current = makeStore();
  return (
    <Provider store={ref.current}>
      <MotionConfig reducedMotion="user">
        <Shell site={site}>
          <Outlet />
        </Shell>
      </MotionConfig>
    </Provider>
  );
}
export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  return (
    <main className="error-page">
      <p className="eyebrow">PORTFOLIO / {status}</p>
      <h1>{status === 404 ? "Страница не найдена." : "Небольшая пауза."}</h1>
      <p>
        {status === 404
          ? "Эта страница не найдена."
          : "Сервис временно недоступен. Попробуйте обновить страницу чуть позже."}
      </p>
      <Link className="text-link" to="/">
        На главную ↗
      </Link>
    </main>
  );
}
