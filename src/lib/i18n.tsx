import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Lang, LocaleCopy } from "@/content/types";
import type { ContentDoc } from "@/lib/locales";

/** Поддерживаемые языки. Порядок совпадает с RU-авторитетом. */
export const SUPPORTED_LANGS: readonly Lang[] = ["ru", "kz", "en"] as const;

const STORAGE_KEY = "rasul-language";

/** HTML lang: казахский контент размечаем как `kk` (кодовый стандарт). */
const HTML_LANG: Record<Lang, string> = { ru: "ru", kz: "kk", en: "en" };

/** Проверка значения на принадлежность к поддерживаемым языкам. */
export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

/** Нормализация: невалидное/пустое значение → fallback `ru`. */
export function normalizeLang(value: unknown): Lang {
  return isLang(value) ? value : "ru";
}

/** Локализованные строки по коду языка (pure, без DOM). */
export function getLocale(locales: Record<Lang, LocaleCopy>, lang: Lang): LocaleCopy {
  return locales[lang];
}

/** Отображение языка в html lang (kz → kk). */
export function htmlLangFor(lang: Lang): string {
  return HTML_LANG[lang];
}

interface I18nContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  copy: LocaleCopy;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "ru";
  try {
    return normalizeLang(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "ru";
  }
}

/**
 * Провайдер локали (FB-T4). Принимает уже загруженный из Firestore `ContentDoc`
 * (загрузка/ошибка — в `App`, здесь только язык и строки). Переключение языка,
 * `document.title`/`meta[name=description]` и html lang сохранены как раньше.
 */
export function LanguageProvider({
  content,
  children,
}: {
  content: ContentDoc;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(normalizeLang(next));
  }, []);

  const copy = useMemo(() => getLocale(content.locales, lang), [content, lang]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage может быть недоступен (private mode) — не критично.
    }
    document.documentElement.lang = htmlLangFor(lang);
    document.title = copy.meta.title;

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", copy.meta.description);
    }
  }, [lang, copy]);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, copy }),
    [lang, setLang, copy],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Доступ к языку и строкам из любого места ниже `<LanguageProvider>`. */
export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LanguageProvider");
  }
  return ctx;
}
