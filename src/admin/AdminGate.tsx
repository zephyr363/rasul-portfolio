import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { onAuthChanged, signOutUser } from "@/admin/lib/auth";
import { subscribeAdminAccess } from "@/admin/lib/access";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/LoadingScreen";

export function AdminGate() {
  const [state, setState] = useState<{ status: "loading" | "anonymous" | "denied" | "error" | "allowed"; user?: User }>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  async function logout() {
    if (signingOut) return;
    setSigningOut(true); setSignOutError(false);
    try { await signOutUser(); }
    catch { setSignOutError(true); }
    finally { setSigningOut(false); }
  }
  useEffect(() => {
    let stopAccess = () => {};
    let generation = 0;
    const stopAuth = onAuthChanged((user) => {
      stopAccess();
      const current = ++generation;
      if (!user) { setState({ status: "anonymous" }); return; }
      setState({ status: "loading" });
      stopAccess = subscribeAdminAccess(user.uid,
        (allowed) => { if (current === generation) setState({ status: allowed ? "allowed" : "denied", user }); },
        () => { if (current === generation) setState({ status: "error" }); });
    });
    return () => { generation++; stopAccess(); stopAuth(); };
  }, [retry]);
  if (state.status === "anonymous") return <Navigate to="/admin/login" replace />;
  if (state.status === "allowed" && state.user) return <AdminLayout user={state.user} />;
  if (state.status === "loading") return <LoadingScreen fullPage label="Проверка доступа…" />;
  return <div className="min-h-dvh bg-bg p-8 text-text">
    <>
      <p role="alert">{state.status === "error" ? "Не удалось проверить доступ. Возможна ошибка подключения или чтения Firestore; отсутствие прав администратора не подтверждено." : "Доступ не предоставлен или отозван."}</p>
      {state.status === "denied" && state.user && <div className="mt-4 space-y-3">
        <p>Вы вошли в аккаунт, но документ доступа отсутствует или его поля не соответствуют требованиям.</p>
        <label className="block">
          UID текущего пользователя
          <input aria-label="UID текущего пользователя" className="mt-1 block w-full max-w-xl select-all rounded border border-border bg-bg p-2 font-mono" readOnly value={state.user.uid} onFocus={(event) => event.currentTarget.select()} />
        </label>
        <p>Передайте UID владельцу Firebase-проекта. В Firebase Console → Firestore Database он должен создать или проверить документ <code className="select-all">adminAccess/{state.user.uid}</code> и поля:</p>
        <ul className="list-inside list-disc">
          <li><code>role</code> — тип string, значение <code>admin</code></li>
          <li><code>enabled</code> — тип boolean, значение <code>true</code> (не строка)</li>
        </ul>
        <p>Вход в аккаунт сам по себе не выдаёт права администратора. После изменения документа доступ обновится автоматически; также можно нажать «Повторить».</p>
      </div>}
      <div className="mt-4 flex gap-3">
        <Button variant="outline" onClick={() => setRetry((v) => v + 1)}>Повторить</Button>
        <Button disabled={signingOut} onClick={() => void logout()}>{signingOut ? "Выход…" : "Выйти"}</Button>
      </div>
      {signOutError && <p role="alert">Не удалось выйти. Повторите попытку.</p>}
    </>
  </div>;
}
