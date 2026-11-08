import {
  getIdTokenResult,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type ActionCodeSettings,
  type User,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

/** Ключ localStorage для email, ожидающего завершения passwordless-входа. */
const EMAIL_LINK_KEY = "adminEmailForSignIn";

/**
 * Вход через Google (popup). Redirect-флоу удалён: в dev/HMR и при перезагрузке
 * он теряет state и приводит к ошибке «missing initial state» на auth-handler.
 * При блокировке popup — понятная ошибка (см. mapAuthError) и альтернатива
 * входа по почте.
 */
export async function signInGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/**
 * Отправляет passwordless (НЕ 2FA) ссылку для входа на email. `handleCodeInApp`
 * = true: ссылка открывается в этом же окне приложения и завершается в
 * `completeEmailLinkIfPresent`. Email сохраняется в localStorage, т.к. для
 * завершения входа по ссылке его нужно передать в `signInWithEmailLink`.
 */
export async function sendEmailLink(email: string): Promise<void> {
  const actionCodeSettings: ActionCodeSettings = {
    url: new URL(`${import.meta.env.BASE_URL}admin/login`, window.location.origin).href,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  localStorage.setItem(EMAIL_LINK_KEY, email);
}

/**
 * Завершает passwordless-вход, если текущий URL содержит email-link. Иначе
 * возвращает `null` (обычная навигация). Требует email, сохранённый
 * `sendEmailLink`.
 */
export async function completeEmailLinkIfPresent(): Promise<User | null> {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;

  const email = localStorage.getItem(EMAIL_LINK_KEY);
  if (!email) return null;

  const result = await signInWithEmailLink(auth, email, window.location.href);
  localStorage.removeItem(EMAIL_LINK_KEY);
  return result.user;
}

/** Выход из текущей сессии. */
export function signOutUser(): Promise<void> {
  return signOut(auth);
}

/**
 * Точная диагностика auth-состояния РОВНО так, как его видят Firestore Rules:
 * `email`/`email_verified`/`firebase.sign_in_provider` читаются из id-token
 * (`claims`), а НЕ из профиля `auth.currentUser` — именно по `claims.email`
 * rules сверяют `isAdmin()`. Если `claims.email` отличается от `user.email`
 * (регистр/алиас) — это и есть причина отказа «Нет доступа», и в конец строки
 * добавляется явная подсказка.
 */
export async function describeAuthState(): Promise<string> {
  const user = auth.currentUser;
  if (!user) return "сессия отсутствует";

  const token = await getIdTokenResult(user);
  const claims = token.claims;

  const state =
    `email=${user.email} · ` +
    `claims.email=${claims.email ?? "нет"} · ` +
    `verified=${String(claims.email_verified)} · ` +
    `provider=${claims.firebase?.sign_in_provider} · ` +
    `uid=${user.uid.slice(0, 8)}`;

  const claimsEmail = claims.email;
  if (claimsEmail && user.email && claimsEmail !== user.email) {
    return `${state} · email в токене отличается от профиля`;
  }
  return state;
}

/** Подписка на изменение auth-состояния. Возвращает функцию отписки. */
export function onAuthChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
