import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

const LEADS_COLLECTION = "leads";

/** Публичный /notify Worker. Продовый дефолт: пересборка без env не должна отключать уведомления. */
const DEFAULT_TG_NOTIFY_URL = "https://rasul-tg-bot.rasulakhmetov2004.workers.dev/notify";

/** URL `/notify` (Vite env). В dev/тестах пусто — уведомления выключены. */
const tgNotifyUrl = (): string | undefined => {
  const override = import.meta.env.VITE_TG_NOTIFY_URL as string | undefined;
  if (override) return override;
  return import.meta.env.PROD ? DEFAULT_TG_NOTIFY_URL : undefined;
};

/**
 * Вторичное уведомление в Telegram после успешной записи заявки.
 * Никогда не влияет на результат createLead: ошибка глушится.
 */
async function notifyTelegram(payload: { leadId: string; name: string; phone: string }): Promise<void> {
  const url = tgNotifyUrl();
  if (!url || typeof fetch !== "function") return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: crypto.randomUUID(), ...payload }),
      keepalive: true,
    });
  } catch {
    // Заявка уже в Firestore; уведомление вторично.
  }
}

/** URL `/delete-lead` того же Worker: сообщение заявки удаляется вместе с заявкой. */
const tgDeleteLeadUrl = (): string | undefined =>
  tgNotifyUrl()?.replace(/\/notify$/, "/delete-lead");

/**
 * Просит бота удалить сообщение(я) удалённой заявки. Ошибка глушится:
 * заявка уже удалена из Firestore, сообщение в боте — вторично.
 */
async function deleteTelegramLeadMessage(leadId: string): Promise<void> {
  const url = tgDeleteLeadUrl();
  const user = auth.currentUser;
  if (!url || !user || typeof fetch !== "function") return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ leadId }),
      keepalive: true,
    });
  } catch {
    // Сообщение в Telegram могло быть уже удалено или устарело (>48 ч).
  }
}

/** Сколько последних заявок грузит стрим CRM (свежие сверху). */
export const LEADS_PAGE_SIZE = 50;

/** Нормализованный телефон: `+7` + 10 цифр (`^\+7\d{10}$`). */
const NORMALIZED_PHONE_RE = /^\+7\d{10}$/;

/** Статусы заявки в CRM (правила допускают переходы только из `new`). */
export type LeadStatus = "new" | "in_progress" | "done" | "spam";

/** Заявка, как она хранится в Firestore (`leads`). */
export interface Lead {
  name: string;
  /** Нормализованный телефон вида `+7XXXXXXXXXX`. */
  phone: string;
  /**
   * Поле-заглушка (источник/страница заявки). Сейчас Firestore Rules требуют
   * `hp == ''`, поэтому по умолчанию — пустая строка.
   */
  hp: string;
  status: LeadStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

/** Входные данные новой заявки из brief-формы. */
export interface LeadInput {
  name: string;
  /** Ввод в маске `+7 (XXX) XXX-XX-XX`. */
  phone: string;
  hp?: string;
}

/**
 * Нормализует телефон из маски `+7 (XXX) XXX-XX-XX` в `+7XXXXXXXXXX`
 * (10 цифр после `+7`, итог `^\+7\d{10}$`). Невалидный ввод бросает ошибку.
 *
 * «8 (XXX) XXX-XX-XX» → «+7…» НЕ приводится намеренно: принимаем только ввод,
 * уже оформленный в маске с `+7` (источник истины — формат поля формы).
 */
export function normalizePhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");

  // Маска `+7 (XXX) XXX-XX-XX` → 11 цифр, начинающихся с `7`.
  const normalized = digits.length === 11 && digits.startsWith("7") ? `+${digits}` : null;

  if (!normalized || !NORMALIZED_PHONE_RE.test(normalized)) {
    throw new Error(
      `Некорректный номер телефона: "${phone}". Ожидается формат +7 (XXX) XXX-XX-XX.`,
    );
  }

  return normalized;
}

/**
 * Создаёт новую заявку в Firestore (`leads`). Возвращает id документа.
 * `createdAt`/`updatedAt` — serverTimestamp() (время сервера), `status` — `new`.
 */
export async function createLead({ name, phone, hp = "" }: LeadInput): Promise<string> {
  const payload: Lead = {
    name: String(name ?? "").trim(),
    phone: normalizePhone(phone),
    hp: hp ?? "", // rules требуют `hp == ''` — пока поле-заглушка, дефолт пустой
    status: "new",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, LEADS_COLLECTION), payload);
  void notifyTelegram({ leadId: ref.id, name: payload.name, phone: payload.phone });
  return ref.id;
}

/**
 * Заявка для UI (результат маппинга доков стрима). В отличие от `Lead`
 * (формат хранения) содержит `id` документа, НЕ экспортирует `hp`, а времена
 * приведены к `Date | undefined` (`serverTimestamp` в момент незавершённой
 * локальной записи ещё не резолвится — для UI это `undefined`).
 */
export interface LeadItem {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  createdAt: Date | undefined;
  updatedAt: Date | undefined;
}

/** Фильтры стрима заявок (пустой объект = без фильтра по статусу). */
export interface LeadStreamFilters {
  status?: LeadStatus;
}

/** Приводит значение времени Firestore к `Date` (или `undefined`, если его нет). */
function toDate(value: unknown): Date | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  // Firestore `Timestamp` (плюс любые совместимые) — по duck-типу `toDate()`.
  if (typeof value === "object" && "toDate" in value) {
    const ts = value as { toDate?: () => Date };
    // Вызов именно методом: Timestamp.toDate() читает this.toMillis().
    if (typeof ts.toDate === "function") return ts.toDate();
  }
  return undefined;
}

/** Маппит документ Firestore в `LeadItem` (hp намеренно не прокидывается). */
function mapLeadDoc(doc: { id: string; data: () => Partial<Lead> }): LeadItem {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name ?? "",
    phone: data.phone ?? "",
    status: data.status ?? "new",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

/**
 * Подписка на заявки: `onSnapshot` по `createdAt` desc, `limit(50)`; фильтр
 * `filters.status` применяется НА КЛИЕНТЕ (серверный where+orderBy требует
 * составной индекс; объём ≤50 позволяет фильтровать локально). Колбэк получает
 * уже отмапленные `LeadItem[]`. Возвращает функцию отписки.
 */
export function getLeadsStream(
  filters: LeadStreamFilters,
  cb: (leads: LeadItem[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  return onSnapshot(
    query(collection(db, LEADS_COLLECTION), orderBy("createdAt", "desc"), limit(LEADS_PAGE_SIZE)),
    (snap) => {
      const items = snap.docs.map(mapLeadDoc);
      cb(filters.status ? items.filter((item) => item.status === filters.status) : items);
    },
    (err) => onError?.(err),
  );
}

/**
 * Меняет статус заявки. Правила Firestore разрешают `update` только если в
 * diff затронуты РОВНО `status` и `updatedAt` (`updatedAt == request.time`) —
 * поэтому пишем строго эти два ключа.
 */
export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  await updateDoc(doc(db, LEADS_COLLECTION, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** Удаляет заявку по id (правила: `allow delete if isAdmin()`); затем — сообщение в боте. */
export async function deleteLead(id: string): Promise<void> {
  await deleteDoc(doc(db, LEADS_COLLECTION, id));
  void deleteTelegramLeadMessage(id);
}

/**
 * Понятный текст ошибки заявок: permission-denied → «войдите владельцем»,
 * отсутствующий composite index → текст с кодом, иначе — исходное сообщение.
 */
export function describeLeadsError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  const msg = err instanceof Error ? err.message : String(err);

  if (code === "permission-denied") {
    return "Нет доступа: войдите под аккаунтом владельца.";
  }
  if (code === "failed-precondition" || /index/i.test(msg)) {
    return `Запрос требует составной индекс Firestore (код: ${code || "failed-precondition"}). Разверните индексы из firestore.indexes.json.`;
  }
  return msg;
}
