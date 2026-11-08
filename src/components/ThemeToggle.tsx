import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme";

import { Button } from "@/components/ui/button";

/** Переключатель темы (light ↔ dark): Sun в тёмной, Moon в светлой. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label="Сменить тему"
      title="Сменить тему"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
