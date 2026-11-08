import { useCallback, useEffect, useState } from "react";

import type { CaseItem } from "@/content/types";
import { getCases } from "@/lib/cases";
import { LanguageProvider } from "@/lib/i18n";
import { getLocales, type ContentDoc } from "@/lib/locales";

import { About } from "@/components/About";
import { Cases } from "@/components/Cases";
import { Contact } from "@/components/Contact";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Services } from "@/components/Services";
import { Button } from "@/components/ui/button";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; content: ContentDoc; cases: CaseItem[] };

/**
 * Загружает контент и кейсы из Firestore одним заходом (общий loading/error).
 * Нет JSON-fallback: любая ошибка (сеть/rules/нет документа) → экран ошибки с
 * «Повторить».
 */
function useSiteData() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async (forceRefresh = false) => {
    setState({ status: "loading" });
    try {
      const options = forceRefresh ? { forceRefresh: true } : undefined;
      const [content, cases] = await Promise.all([getLocales(options), getCases(options)]);
      setState({ status: "ready", content, cases });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, retry: () => load(true) };
}

/** Skeleton-экран на время загрузки (не мигание пустых секций). */
function LoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-text"
    >
      <div className="h-3 w-44 animate-pulse rounded-full bg-surface" />
      <div className="h-3 w-64 animate-pulse rounded-full bg-surface" />
      <div className="h-3 w-52 animate-pulse rounded-full bg-surface" />
      <p className="mt-2 text-sm text-muted">Загрузка…</p>
    </div>
  );
}

/** Экран ошибки загрузки: понятный текст + кнопка «Повторить». */
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-text"
    >
      <h1 className="text-display text-2xl font-bold">Не удалось загрузить данные</h1>
      <p className="max-w-[480px] text-muted">
        Не удалось загрузить данные. Проверьте подключение.
      </p>
      <p className="max-w-[560px] break-words text-xs text-muted">{message}</p>
      <Button onClick={onRetry} className="mt-2">
        Повторить
      </Button>
    </div>
  );
}

/**
 * Порядок секций (CEO UI-BATCH):
 * Header → Hero → About + Experience(#about/#experience) → Services(#services) →
 * Cases(#cases, alias #projects) → Contact(#contact). В конце каждой секции —
 * переход-строка к следующей.
 */
function SiteView({ cases }: { cases: CaseItem[] }) {
  return (
    <div id="top" className="min-h-screen bg-bg text-text">
      <Header />
      <main>
        <Hero />
        <About />
        <Services />
        <Cases cases={cases} />
        <Contact />
      </main>
    </div>
  );
}

/** Публичный сайт (`/`): loading → error(+retry) → контент. */
export default function Site() {
  const { state, retry } = useSiteData();

  if (state.status === "loading") {
    return <LoadingScreen />;
  }

  if (state.status === "error") {
    return <ErrorScreen message={state.message} onRetry={retry} />;
  }

  return (
    <LanguageProvider content={state.content}>
      <SiteView cases={state.cases} />
    </LanguageProvider>
  );
}
