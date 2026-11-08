import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  completeEmailLinkIfPresent,
  onAuthChanged,
  sendEmailLink,
  signInGoogle,
} from "@/admin/lib/auth";

/** Понятное сообщение об ошибке входа по коду Firebase Auth. */
export function mapAuthError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  switch (code) {
    case "auth/unauthorized-domain":
      return "Этот домен не разрешён для входа. Добавьте его в Authorized domains в Firebase Console.";
    case "auth/invalid-email":
      return "Некорректный email. Проверьте адрес и попробуйте снова.";
    case "auth/popup-blocked":
    case "auth/cancelled-popup-request":
      return "Всплывающее окно заблокировано браузером. Разрешите всплывающие окна или используйте вход по почте.";
    default:
      return "Не удалось выполнить вход. Попробуйте ещё раз.";
  }
}

/**
 * Экран входа (Google / email-link). После успешного входа: админ → `/admin`,
 * чужой email → «Доступ только для владельца» + logout. При возврате по
 * email-ссылке вход дозавершается автоматически; результат Google-redirect
 * подхватывается через `onAuthStateChanged`.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(
    null,
  );

  const handleUser = useCallback(
    (user: User | null) => {
      if (!user) return;
      navigate("/admin/leads", { replace: true });
    },
    [navigate],
  );

  useEffect(() => {
    // Возврат по email-ссылке (passwordless) — дозавершаем вход.
    void completeEmailLinkIfPresent()
      .then(handleUser)
      .catch((err: unknown) => setNotice({ kind: "error", text: mapAuthError(err) }));
    // Результат Google-redirect после перезагрузки страницы.
    return onAuthChanged(handleUser);
  }, [handleUser]);

  async function handleGoogle() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const user = await signInGoogle();
      if (user) handleUser(user);
      // null → начался redirect; результат придёт через onAuthChanged.
    } catch (err) {
      setNotice({ kind: "error", text: mapAuthError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setNotice({ kind: "error", text: "Введите email." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await sendEmailLink(trimmed);
      setNotice({
        kind: "info",
        text: "Ссылка для входа отправлена на почту. Откройте её, чтобы войти.",
      });
    } catch (err) {
      setNotice({ kind: "error", text: mapAuthError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-text">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
        <h1 className="text-display text-xl font-bold">Вход для владельца</h1>
        <p className="mt-2 text-sm text-muted">
          Доступ выдаётся владельцем для UID аккаунта после входа.
        </p>

        <Button className="mt-6 w-full" onClick={handleGoogle} disabled={busy}>
          Войти через Google
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          или по почте
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
            />
          </label>
          <Button type="submit" variant="outline" disabled={busy}>
            Получить ссылку для входа
          </Button>
        </form>

        {notice && (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={`mt-4 text-sm ${
              notice.kind === "error" ? "text-destructive" : "text-muted"
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>
    </div>
  );
}
