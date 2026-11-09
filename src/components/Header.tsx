import { useState } from "react";
import { Menu } from "lucide-react";

import { useLocale } from "@/lib/i18n";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ANCHORS = ["#cases", "#services", "#about", "#experience", "#contact"] as const;

/** Липкая шапка: якорная навигация, переключатель языка, тема и CTA (без лого). */
export function Header() {
  const { copy } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md [padding-top:env(safe-area-inset-top)]">
      <div className="mx-auto flex h-[66px] w-full max-w-[1200px] items-center gap-3 px-6 sm:px-8">
        <nav className="hidden items-center gap-6 min-[851px]:flex" aria-label="Main">
          {copy.nav.links.map((label, i) => (
            <a
              key={NAV_ANCHORS[i]}
              href={NAV_ANCHORS[i]}
              className="text-sm font-medium text-muted transition-colors hover:text-text"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <LanguageSwitcher />
          <ThemeToggle />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="min-[851px]:hidden"
                aria-label="Меню"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] gap-0">
              <SheetHeader>
                <SheetTitle className="text-display sr-only">Меню</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4 pt-2" aria-label="Mobile">
                {copy.nav.links.map((label, i) => (
                  <a
                    key={NAV_ANCHORS[i]}
                    href={NAV_ANCHORS[i]}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-text"
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
