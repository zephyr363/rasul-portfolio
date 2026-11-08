import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function subscribeAdminAccess(uid: string, next: (allowed: boolean) => void, error: (error: Error) => void): () => void {
  return onSnapshot(doc(db, "adminAccess", uid), (snapshot) => {
    const grant = snapshot.data();
    next(snapshot.exists() && grant?.role === "admin" && grant.enabled === true);
  }, error);
}
