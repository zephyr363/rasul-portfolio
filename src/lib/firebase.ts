import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";

/**
 * Firebase-фундамент (FB-T3). Конфиг открытый (public web config) — это не
 * секрет: авторитет над данными задаёт Firestore Rules, а не клиентский код.
 * Analytics не подключается намеренно (не нужна).
 */
const firebaseConfig = {
  apiKey: "AIzaSyCmX0CUAZZ6HCRRNfqXPGMjZRBp3NQvVAI",
  authDomain: "porfo-ddb46.firebaseapp.com",
  projectId: "porfo-ddb46",
  messagingSenderId: "331236292162",
  appId: "1:331236292162:web:5219d33987f20b5a3b9fdb",
};

export const app: FirebaseApp = initializeApp(firebaseConfig);

/** Firestore-инстанс проекта (siteContent/cases/leads). */
export const db: Firestore = getFirestore(app);

/** Auth-инстанс проекта (Google popup + passwordless email-link). */
export const auth: Auth = getAuth(app);

// Сессия хранится в localStorage (переживает перезагрузку/закрытие вкладки),
// а не в памяти вкладки. Асинхронный результат не критичен для инициализации,
// поэтому игнорируем promise; любые ошибки persistence всплывут на первом
// auth-вызове.
void setPersistence(auth, browserLocalPersistence);
