import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Тема light/dark/system (CEO UI-BATCH). Единый `<html data-theme="light|dark">`
 * для публичного сайта и CRM. По умолчанию — системная (`prefers-color-scheme`);
 * переключатель явно сохраняет выбор в `localStorage['rasul-theme']`.
 */

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

const STORAGE_KEY = "rasul-theme";
const THEME_ATTR = "data-theme";

/** Системная тема: тёмная при `prefers-color-scheme: dark` (в jsdom — false). */
function prefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Явный выбор из localStorage: `light`/`dark` или `null` (системная). */
function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage может быть недоступен (private mode) — не критично.
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(THEME_ATTR, theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#fafaf9" : "#0c0c0c");
}

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Эффективная тема (явная или системная). */
  theme: Theme;
  /** Переключение light ↔ dark (сохраняет явный выбор). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Theme | null>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark);

  // Следим за системной темой, пока пользователь не выбрал явно.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme = useMemo<Theme>(
    () => stored ?? (systemDark ? "dark" : "light"),
    [stored, systemDark],
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setStored((prev) => {
      const current: Theme = prev ?? (systemDark ? "dark" : "light");
      const next: Theme = current === "dark" ? "light" : "dark";
      writeStoredTheme(next);
      return next;
    });
  }, [systemDark]);

  const setPreference = useCallback((preference: ThemePreference) => {
    setStored(preference === "system" ? null : preference);
    try {
      if (preference === "system") window.localStorage.removeItem(STORAGE_KEY);
      else writeStoredTheme(preference);
    } catch { /* Storage can be unavailable. */ }
  }, []);
  const value = useMemo<ThemeContextValue>(() => ({ theme, toggle, preference: stored ?? "system", setPreference }), [theme, toggle, stored, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Доступ к теме и переключателю из любого места ниже `<ThemeProvider>`. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
