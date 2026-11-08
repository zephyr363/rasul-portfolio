import { Check, ChevronDown } from "lucide-react";

import type { Lang } from "@/content/types";
import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGS: readonly { code: Lang; label: string }[] = [
  { code: "ru", label: "RU" },
  { code: "kz", label: "KZ" },
  { code: "en", label: "EN" },
];

/** Выпадающий переключатель RU/KZ/EN: триггер с текущим языком + ChevronDown. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLocale();
  const active = LANGS.find((item) => item.code === lang) ?? LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5", className)}
        >
          <span className="font-semibold">{active.label}</span>
          <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((item) => (
          <DropdownMenuItem
            key={item.code}
            onSelect={() => setLang(item.code)}
            className="flex items-center justify-between gap-3"
          >
            <span className="font-semibold">{item.label}</span>
            {lang === item.code && <Check className="size-4" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
