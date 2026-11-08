import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { Button } from "@/components/ui/button";

export function SettingsPage() {
  const { preference, setPreference } = useTheme();
  const user = auth.currentUser;
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const providers = user?.providerData.map((p) => p.providerId) ?? [];
  async function reset() {
    if (pending || !user?.email) return;
    setPending(true); setNotice(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setNotice({ error: false, text: "Запрос отправлен. Проверьте почту и следуйте инструкции Firebase, если письмо доступно для этого аккаунта. Пароль здесь не изменён." });
    } catch {
      setNotice({ error: true, text: "Не удалось отправить письмо. Проверьте подключение и настройки Email/Password в Firebase." });
    } finally { setPending(false); }
  }
  return <section className="max-w-xl space-y-5">
    <h1 className="text-2xl font-bold">Настройки</h1>
    <label className="flex flex-col gap-2">Тема <select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-text focus-visible:outline-2 focus-visible:outline-accent" aria-label="Тема" value={preference} onChange={(e) => setPreference(e.target.value as ThemePreference)}>
      <option value="system">Системная</option><option value="light">Светлая</option><option value="dark">Тёмная</option>
    </select></label>
    <p>Email: {user?.email ?? "Не указан"}</p>
    <p>Способ входа: {providers.join(", ") || "Не определён"}</p>
    <h2 className="text-lg font-bold">Пароль</h2>
    <p>Вход через Google или ссылку на email не требует существующего пароля. Пароль Google меняется в аккаунте Google. Firebase может отправить письмо для установки или сброса пароля только при поддержке Email/Password в проекте; отправка письма не означает смену пароля.</p>
    <Button disabled={pending || !user?.email} onClick={() => void reset()}>{pending ? "Отправка…" : "Отправить письмо для сброса пароля"}</Button>
    {notice && <p role={notice.error ? "alert" : "status"}>{notice.text}</p>}
  </section>;
}
