import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Briefcase, FileText, Inbox, LogOut, Menu } from "lucide-react";
import type { User } from "firebase/auth";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOutUser } from "@/admin/lib/auth";
import { cn } from "@/lib/utils";
import { NavigationProtectionProvider, useNavigationProtection } from "@/admin/lib/navigation-protection";

const NAV = [
  { to: "/admin/settings", label: "Настройки", icon: FileText },
  { to: "/admin/leads", label: "Заявки", icon: Inbox },
  { to: "/admin/cases", label: "Кейсы", icon: Briefcase },
  { to: "/admin/content", label: "Контент", icon: FileText },
] as const;

/** Пункты бокового меню (NavLink с активным состоянием). */
function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Разделы админ-панели">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:min-h-0",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:bg-surface hover:text-text",
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Каркас админ-панели (FB-T5, T7 наполнит разделы): sidebar (Заявки/Кейсы/
 * Контент), topbar (email + Выйти) и контентная область через `<Outlet/>`.
 * Адаптив: на ≤900px sidebar сворачивается в Drawer (Sheet).
 */
export function AdminLayout({ user }: { user: User }) {
  return <NavigationProtectionProvider><ProtectedAdminLayout user={user} /></NavigationProtectionProvider>;
}

function ProtectedAdminLayout({ user }: { user: User }) {
  const { confirmDiscard } = useNavigationProtection();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  async function logout() {
    if (signingOut || !confirmDiscard()) return;
    setSigningOut(true); setSignOutError(false);
    try { await signOutUser(); }
    catch { setSignOutError(true); }
    finally { setSigningOut(false); }
  }

  return (
    <div data-admin-layout className="flex min-h-dvh bg-bg text-text">
      {/* Sidebar — desktop (≥900px) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border p-4 min-[900px]:flex">
        <div className="text-display mb-6 text-lg font-bold">Админ-панель</div>
        <NavItems />
        <div className="mt-auto border-t border-border pt-4">
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
      </aside>

      {/* Контентная колонка */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-[900px]:hidden"
                aria-label="Открыть меню"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle className="text-display">Админ-панель</SheetTitle>
              </SheetHeader>
              <NavItems onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <span className="text-display text-lg font-bold min-[900px]:hidden">
            Админ-панель
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden min-w-0 max-w-64 truncate text-sm text-muted sm:block" title={user.email ?? undefined}>{user.email}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={signingOut}
              onClick={() => void logout()}
            >
              <LogOut className="size-4" />
              Выйти
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {signOutError && <p role="alert" className="text-sm text-destructive">Не удалось выйти. Повторите попытку.</p>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
