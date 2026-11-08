import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { useBlocker } from "react-router-dom";

type Guard = { dirty: boolean; pending: boolean };
const message = "Есть несохранённые изменения. Покинуть страницу и потерять их?";
const ProtectionContext = createContext<MutableRefObject<(() => boolean) | null> | null>(null);

/** Scoped to authenticated layout: auth revocation unmounts guards immediately. */
export function NavigationProtectionProvider({ children }: { children: ReactNode }) {
  const guard = useRef<(() => boolean) | null>(null);
  return <ProtectionContext.Provider value={guard}>{children}</ProtectionContext.Provider>;
}

export function useNavigationProtection() {
  const guard = useContext(ProtectionContext);
  if (!guard) throw new Error("useNavigationProtection requires NavigationProtectionProvider");
  return { confirmDiscard: () => guard.current?.() ?? true };
}

/** Requires a data router; standalone memory-router harnesses need no provider. */
export function useUnsavedChanges({ dirty, pending }: Guard) {
  const registration = useContext(ProtectionContext);
  const current = useRef({ dirty, pending });
  useLayoutEffect(() => { current.current = { dirty, pending }; }, [dirty, pending]);
  const confirmDiscard = useCallback(() => {
    if (current.current.pending) return false;
    return !current.current.dirty || window.confirm(message);
  }, []);
  const blocker = useBlocker(useCallback(() => current.current.dirty || current.current.pending, []));
  useLayoutEffect(() => {
    if (!registration) return;
    registration.current = confirmDiscard;
    return () => { if (registration.current === confirmDiscard) registration.current = null; };
  }, [registration, confirmDiscard]);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (confirmDiscard()) blocker.proceed();
    else blocker.reset();
  }, [blocker, confirmDiscard]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!current.current.dirty && !current.current.pending) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  return { confirmDiscard };
}
