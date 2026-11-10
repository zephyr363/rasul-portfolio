/**
 * Telegram-бот заявок (Cloud Functions 2nd gen, проект porfo-ddb46).
 *
 * Секреты (задаются через `firebase functions:secrets:set`, в коде/репо не хранятся):
 *  - BOT_TOKEN         — токен бота;
 *  - ADMIN_CHAT_ID     — chat_id администратора;
 *  - TG_WEBHOOK_SECRET — secret_token вебхука (заголовок X-Telegram-Bot-Api-Secret-Token).
 *
 * Firestore (через Admin SDK, в обход правил для клиентов):
 *  - leads/{leadId}.tgNotifiedAt    — отметка «заявка отправлена в Telegram»;
 *  - leads/{leadId}.tgUuid          — UUID из сообщения (для распознавания/сопоставления);
 *  - _botState/config.maintenanceOn — флаг техработ;
 *  - _botState/chats/{chatId}       — реестр чатов для рассылок.
 */

import { initializeApp } from "firebase-admin/app";
import { randomUUID } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

const BOT_TOKEN = defineSecret("BOT_TOKEN");
const ADMIN_CHAT_ID = defineSecret("ADMIN_CHAT_ID");
const TG_WEBHOOK_SECRET = defineSecret("TG_WEBHOOK_SECRET");

/** Шаблон сообщения о новой заявке (parse_mode=HTML, плейсхолдеры подставляются экранированными). */
const LEAD_MESSAGE_TEMPLATE = [
  "🔔 <b>Новая заявка с сайта</b>",
  "",
  "id: {id}",
  "👤 Имя: {name}",
  "📞 Телефон: {phone}",
  "🕒 Дата: {date}",
].join("\n");

const MAINTENANCE_ON_TEXT = "🔧 На сайте технические работы. Скоро вернусь!";
const MAINTENANCE_OFF_TEXT = "✅ Технические работы завершены — работа возобновлена.";

const TG_API = "https://api.telegram.org";

// ---------- Telegram API ----------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Дата в читаемом виде (время сайта — московское). */
const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(date);

async function tgCall(method: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(`${TG_API}/bot${BOT_TOKEN.value()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** sendMessage с одним повтором при 429 (учитывает Retry-After, иначе ждёт 1.5 с). */
async function sendMessage(chatId: string, text: string): Promise<void> {
  const send = () => tgCall("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });

  let res = await send();
  if (res.status === 429) {
    const retryAfterMs = Number(res.headers.get("retry-after")) * 1000;
    await sleep(Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 1500);
    res = await send();
  }

  if (!res.ok) {
    throw new Error(`Telegram sendMessage ${res.status}: ${await res.text()}`);
  }
}

// ---------- 1) Новая заявка → уведомление админу ----------

/** Поля заявки, нужные для сообщения (формат из src/data/leads.ts). */
interface LeadFields {
  name?: string;
  phone?: string;
  /** Firestore Timestamp — читаем по duck-типу toDate(). */
  createdAt?: { toDate?: () => Date };
  tgNotifiedAt?: unknown;
}

export const onLeadCreated = onDocumentCreated(
  { document: "leads/{leadId}", secrets: [BOT_TOKEN, ADMIN_CHAT_ID] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const lead = snap.data() as LeadFields;

    // Guard: повторное событие / уведомление уже ушло.
    if (lead.tgNotifiedAt != null) return;

    const name = String(lead.name ?? "").trim();
    const phone = String(lead.phone ?? "");
    const createdAt = lead.createdAt?.toDate?.() ?? new Date();
    // UUID для распознавания сообщения и сопоставления с заявкой.
    const uuid = randomUUID();

    // callback-и в replace — чтобы `$` в данных не сработал как спец-паттерн.
    const text = LEAD_MESSAGE_TEMPLATE
      .replace("{id}", () => uuid)
      .replace("{name}", () => escapeHtml(name) || "—")
      .replace("{phone}", () => escapeHtml(phone) || "—")
      .replace("{date}", () => formatDate(createdAt));

    await sendMessage(ADMIN_CHAT_ID.value(), text);

    // Admin SDK пишет вне правил (те ограничивают только клиентов); поле не входит
    // в клиентский update-diff статуса, поэтому правилам CRM не мешает.
    await db.doc(`leads/${snap.id}`).update({
      tgNotifiedAt: FieldValue.serverTimestamp(),
      tgUuid: uuid,
    });
  },
);

// ---------- 2) Вебхук бота (команды админа + реестр чатов) ----------

interface TgChat {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
}

interface TgUpdate {
  message?: { chat: TgChat; text?: string };
  my_chat_member?: { chat: TgChat; new_chat_member?: { status?: string } };
}

/** Upsert чата в реестр `_botState/chats/{chatId}`; пишет только при изменении (без лишних записей). */
async function upsertChat(chat: TgChat): Promise<void> {
  const chatId = String(chat.id);
  const title = chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ");
  const ref = db.doc(`_botState/chats/${chatId}`);

  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data();
    if (data?.title === title && data?.type === chat.type) return;
    await ref.set({ chatId, title, type: chat.type }, { merge: true });
  } else {
    await ref.set({ chatId, title, type: chat.type, addedAt: FieldValue.serverTimestamp() });
  }
}

/** Рассылка текста всем чатам реестра; сбой одного чата не роняет рассылку. */
async function broadcast(text: string): Promise<void> {
  const snap = await db.collection("_botState/chats").get();
  await Promise.all(
    snap.docs.map((doc) =>
      sendMessage(String(doc.data().chatId ?? doc.id), text).catch((err: unknown) =>
        logger.warn(`broadcast → ${doc.id} failed:`, err),
      ),
    ),
  );
}

/** Команды администратора (вызывается только для ADMIN_CHAT_ID). */
async function handleCommand(text: string, chatId: string): Promise<void> {
  const [command, ...args] = text.split(/\s+/);
  const arg = args.join(" ").trim();

  switch (command) {
    case "/maintenance": {
      if (arg !== "on" && arg !== "off") {
        await sendMessage(chatId, "Использование: /maintenance on|off");
        return;
      }
      const on = arg === "on";
      await db
        .doc("_botState/config")
        .set({ maintenanceOn: on, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await broadcast(on ? MAINTENANCE_ON_TEXT : MAINTENANCE_OFF_TEXT);
      return;
    }
    case "/broadcast": {
      if (!arg) {
        await sendMessage(chatId, "Использование: /broadcast <текст>");
        return;
      }
      if (arg.length > 4000) {
        await sendMessage(chatId, "Слишком длинное сообщение (максимум 4000 символов).");
        return;
      }
      await broadcast(escapeHtml(arg));
      return;
    }
    case "/start": {
      await sendMessage(chatId, "🤖 Бот заявок на связи. Команды доступны только администратору.");
      return;
    }
    default:
      logger.info(`Unknown command ignored: ${command}`);
  }
}

export const tgWebhook = onRequest(
  { secrets: [BOT_TOKEN, ADMIN_CHAT_ID, TG_WEBHOOK_SECRET] },
  async (req, res) => {
    // Вебхук без правильного secret_token — сразу 401.
    if (req.header("X-Telegram-Bot-Api-Secret-Token") !== TG_WEBHOOK_SECRET.value()) {
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      const update = (req.body ?? {}) as TgUpdate;

      // Бот добавлен/удалён в чате: добавлен → в реестр, удалён → убрать из рассылки.
      if (update.my_chat_member) {
        const status = update.my_chat_member.new_chat_member?.status;
        if (status === "left" || status === "kicked") {
          await db.doc(`_botState/chats/${update.my_chat_member.chat.id}`).delete();
        } else {
          await upsertChat(update.my_chat_member.chat);
        }
        res.status(200).send("ok");
        return;
      }

      const msg = update.message;
      if (!msg) {
        res.status(200).send("ok");
        return;
      }

      // Групповые чаты тоже сохраняем (для рассылок).
      if (msg.chat.type !== "private") {
        await upsertChat(msg.chat);
      }

      // Команды принимает ТОЛЬКО администратор.
      const chatId = String(msg.chat.id);
      const text = (msg.text ?? "").trim();
      if (chatId === ADMIN_CHAT_ID.value() && text.startsWith("/")) {
        await handleCommand(text, chatId);
      }

      res.status(200).send("ok");
    } catch (err) {
      // Отвечаем 200, чтобы Telegram не засыпал ретраями; детали — в логах.
      logger.error("tgWebhook error:", err);
      res.status(200).send("ok");
    }
  },
);
