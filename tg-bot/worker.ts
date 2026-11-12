// Telegram-бот заявок для Cloudflare Workers (free plan, без карты).
//
// Маршруты:
//   POST /telegram — webhook Telegram: команды админов группы + авто-регистрация чатов
//   POST /notify   — вызов из формы сайта после записи заявки в Firestore
//   GET  /         — health
//
// Bindings (Settings → Variables and Secrets / KV):
//   BOT_TOKEN          — secret, токен из @BotFather
//   TG_WEBHOOK_SECRET  — secret, secret_token вебхука
//   ADMIN_CHAT_ID      — необязательно: дублировать заявки в личку
//   ALLOWED_ORIGIN     — var, домены формы через запятую
//   TG_KV              — KV namespace для состояния (чаты, флаг, rate limit)

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

interface Env {
  BOT_TOKEN: string;
  TG_WEBHOOK_SECRET: string;
  ADMIN_CHAT_ID?: string;
  ALLOWED_ORIGIN?: string;
  /** JSON сервисного аккаунта Firebase (secret) — для смены статуса заявки. */
  FIREBASE_SA?: string;
  FIREBASE_PROJECT_ID?: string;
  /** Пароль для входа в бота (secret). Без него команды недоступны. */
  BOT_ADMIN_PASSWORD?: string;
  TG_KV: KV;
}

const TG_API = "https://api.telegram.org";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^\+7\d{10}$/;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Almaty",
  }).format(d);

const allowedOrigins = (env: Env): string[] =>
  (env.ALLOWED_ORIGIN ?? "https://zephyr363.github.io,http://localhost:5180")
    .split(",").map((s) => s.trim()).filter(Boolean);

function cors(env: Env, origin: string | null): Record<string, string> {
  const list = allowedOrigins(env);
  return {
    "Access-Control-Allow-Origin": origin && list.includes(origin) ? origin : list[0] ?? "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Vary": "Origin",
  };
}

async function tgCall(env: Env, method: string, payload: Record<string, unknown>) {
  return fetch(`${TG_API}/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function sendMessage(
  env: Env,
  chatId: string,
  text: string,
  replyMarkup?: unknown,
): Promise<number | undefined> {
  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  let res = await tgCall(env, "sendMessage", payload);
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after")) * 1000;
    await new Promise((r) => setTimeout(r, Number.isFinite(retry) && retry > 0 ? retry : 1500));
    res = await tgCall(env, "sendMessage", payload);
  }
  if (!res.ok) throw new Error(`sendMessage ${res.status}: ${await res.text()}`);
  const data = await res.json() as { result?: { message_id?: number } };
  return data.result?.message_id;
}

interface Chat { id: number; type: string; title?: string; first_name?: string; last_name?: string }
interface ChatRecord { chatId: string; title: string; type: string; addedAt: number }

async function kvList(env: Env, prefix: string): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await env.TG_KV.list({ prefix, cursor });
    for (const k of res.keys) names.push(k.name);
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return names;
}

/** Возвращает true, если чат встретился впервые. */
async function upsertChat(env: Env, chat: Chat): Promise<boolean> {
  const chatId = String(chat.id);
  const title = chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ");
  const key = `chat:${chatId}`;
  const raw = await env.TG_KV.get(key);
  const existing = raw ? JSON.parse(raw) as ChatRecord : null;
  if (existing && existing.title === title && existing.type === chat.type) return false;
  await env.TG_KV.put(key, JSON.stringify({
    chatId,
    title,
    type: chat.type,
    addedAt: existing?.addedAt ?? Date.now(),
  } satisfies ChatRecord));
  return !existing;
}

/** Чаты-получатели заявок: все группы, где есть бот (+ ADMIN_CHAT_ID, если задан). */
async function notifyTargets(env: Env): Promise<string[]> {
  const ids: string[] = [];
  for (const key of await kvList(env, "chat:")) {
    const raw = await env.TG_KV.get(key);
    if (!raw) continue;
    const chat = JSON.parse(raw) as ChatRecord;
    if (chat.type === "group" || chat.type === "supergroup") ids.push(chat.chatId);
  }
  if (env.ADMIN_CHAT_ID) ids.push(env.ADMIN_CHAT_ID);
  return [...new Set(ids)];
}

async function broadcast(env: Env, text: string): Promise<void> {
  for (const key of await kvList(env, "chat:")) {
    const raw = await env.TG_KV.get(key);
    if (!raw) continue;
    const chat = JSON.parse(raw) as ChatRecord;
    try {
      await sendMessage(env, chat.chatId, text);
    } catch (err) {
      console.warn(`broadcast → ${chat.chatId} failed:`, err);
    }
  }
}

/** Команды: приватный ADMIN_CHAT_ID или администратор/создатель группы, где есть бот. */
async function isAuthorized(env: Env, chatId: string, userId?: number): Promise<boolean> {
  if (env.ADMIN_CHAT_ID && chatId === env.ADMIN_CHAT_ID) return true;
  if (!userId) return false;
  if (!(await env.TG_KV.get(`chat:${chatId}`))) return false;
  try {
    const res = await tgCall(env, "getChatMember", { chat_id: chatId, user_id: userId });
    if (!res.ok) return false;
    const data = await res.json() as { ok?: boolean; result?: { status?: string } };
    const status = data.result?.status;
    return Boolean(data.ok) && (status === "creator" || status === "administrator");
  } catch {
    return false;
  }
}

// ---------- Firestore (сервисный аккаунт, для смены статуса) ----------

let tokenCache: { token: string; exp: number } | null = null;

const b64url = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlStr = (s: string): string => b64url(new TextEncoder().encode(s));

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(env: Env): Promise<string> {
  if (tokenCache && tokenCache.exp > Math.floor(Date.now() / 1000) + 60) return tokenCache.token;
  const sa = JSON.parse(env.FIREBASE_SA ?? "") as { client_email?: string; private_key?: string };
  if (!sa.client_email || !sa.private_key) throw new Error("FIREBASE_SA не задан или неполный");
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlStr(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const assertion = `${header}.${claims}.${b64url(new Uint8Array(sig))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`oauth ${res.status}: ${await res.text()}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

async function updateLeadStatus(env: Env, leadId: string, status: string): Promise<void> {
  const token = await getAccessToken(env);
  const project = env.FIREBASE_PROJECT_ID ?? "porfo-ddb46";
  const mask = new URLSearchParams();
  mask.append("updateMask.fieldPaths", "status");
  mask.append("updateMask.fieldPaths", "updatedAt");
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/leads/${encodeURIComponent(leadId)}?${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      fields: {
        status: { stringValue: status },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) throw new Error(`firestore ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const LEAD_STATUSES = ["new", "in_progress", "done", "spam"] as const;

const SESSION_TTL = 60 * 60 * 12; // 12 часов
const sessionKey = (chatId: string, userId: number) => `auth:${chatId}:${userId}`;

async function isLoggedIn(env: Env, chatId: string, userId: number): Promise<boolean> {
  return (await env.TG_KV.get(sessionKey(chatId, userId))) === "1";
}

async function handleCommand(env: Env, text: string, chatId: string, userId: number): Promise<void> {
  const [command, ...args] = text.split(/\s+/);
  const arg = args.join(" ").trim();

  // Вход/выход доступны администратору группы без сессии.
  if (command === "/login") {
    if (!env.BOT_ADMIN_PASSWORD) {
      await sendMessage(env, chatId, "⚠️ Пароль бота не настроен: задайте секрет BOT_ADMIN_PASSWORD.");
      return;
    }
    if (arg !== env.BOT_ADMIN_PASSWORD) {
      await sendMessage(env, chatId, "❌ Неверный пароль.");
      return;
    }
    await env.TG_KV.put(sessionKey(chatId, userId), "1", { expirationTtl: SESSION_TTL });
    await sendMessage(env, chatId, "✅ Вход выполнен. Команды доступны 12 часов.");
    return;
  }
  if (command === "/logout") {
    await env.TG_KV.delete(sessionKey(chatId, userId));
    await sendMessage(env, chatId, "👋 Вы вышли.");
    return;
  }
  if (command === "/start") {
    await sendMessage(env, chatId, "🤖 Бот заявок на связи. Заявки с сайта приходят в эту группу.\nВход для администраторов: /login <пароль>.");
    return;
  }

  if (!(await isLoggedIn(env, chatId, userId))) {
    await sendMessage(env, chatId, "🔒 Нужен вход: /login <пароль>");
    return;
  }

  switch (command) {
    case "/maintenance": {
      if (arg !== "on" && arg !== "off") {
        await sendMessage(env, chatId, "Использование: /maintenance on|off");
        return;
      }
      const on = arg === "on";
      await env.TG_KV.put("config:maintenance", String(on));
      await broadcast(env, on
        ? "🔧 На сайте технические работы. Скоро вернусь!"
        : "✅ Технические работы завершены — работа возобновлена.");
      return;
    }
    case "/broadcast": {
      if (!arg) return void (await sendMessage(env, chatId, "Использование: /broadcast <текст>"));
      if (arg.length > 4000) {
        return void (await sendMessage(env, chatId, "Слишком длинное сообщение (максимум 4000 символов)."));
      }
      await broadcast(env, escapeHtml(arg));
      return;
    }
    case "/changeLeadStatus": {
      const [rawId, status] = arg.split(/\s+/);
      if (!rawId || !LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
        await sendMessage(env, chatId, "Использование: /changeLeadStatus <id> <new|in_progress|done|spam>");
        return;
      }
      if (!env.FIREBASE_SA) {
        await sendMessage(env, chatId, "⚠️ Firestore не настроен: добавьте секрет FIREBASE_SA (ключ сервисного аккаунта).");
        return;
      }
      let leadId = await env.TG_KV.get(`lead:${rawId}`);
      if (!leadId && /^[A-Za-z0-9]{15,}$/.test(rawId)) leadId = rawId;
      if (!leadId) {
        await sendMessage(env, chatId, `❌ Заявка «${escapeHtml(rawId)}» не найдена.`);
        return;
      }
      try {
        await updateLeadStatus(env, leadId, status);
        await sendMessage(env, chatId, `✅ Статус заявки <code>${escapeHtml(rawId)}</code> → <b>${status}</b>`);
      } catch (err) {
        console.error("changeLeadStatus failed:", err);
        await sendMessage(env, chatId, `⚠️ Не удалось обновить статус: ${escapeHtml(String(err).slice(0, 200))}`);
      }
      return;
    }
    default:
      console.info(`unknown command ignored: ${command}`);
  }
}

async function handleNotify(env: Env, req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const headers = cors(env, origin);
  if (!allowedOrigins(env).includes(origin ?? "")) {
    return new Response("forbidden origin", { status: 403, headers });
  }

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
  const rlKey = `rl:${ip}`;
  const count = Number(await env.TG_KV.get(rlKey) ?? "0") + 1;
  if (count > 20) return new Response("too many requests", { status: 429, headers });
  await env.TG_KV.put(rlKey, String(count), { expirationTtl: 60 });

  let body: { id?: string; leadId?: string; name?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400, headers });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (!name || name.length > 100 || !PHONE_RE.test(phone)) {
    return new Response("invalid payload", { status: 400, headers });
  }

  const id = body.id && UUID_RE.test(body.id) ? body.id : crypto.randomUUID();
  // Запоминаем соответствие uuid → id документа Firestore (для /changeLeadStatus).
  if (body.leadId) {
    await env.TG_KV.put(`lead:${id}`, String(body.leadId), { expirationTtl: 60 * 60 * 24 * 180 });
  }

  const waDigits = phone.replace(/\D/g, "");
  const waText = encodeURIComponent("Здравствуйте! Пишу по вашей заявке с сайта.");
  const replyMarkup = waDigits
    ? { inline_keyboard: [[{ text: "💬 Написать в WhatsApp", url: `https://wa.me/${waDigits}?text=${waText}` }]] }
    : undefined;

  const text = [
    "🔔 <b>Новая заявка с сайта</b>",
    "",
    `id: ${id}`,
    `👤 Имя: ${escapeHtml(name)}`,
    `📞 Телефон: ${escapeHtml(phone)}`,
    `🕒 Дата: ${formatDate(new Date())}`,
  ].join("\n");

  const targets = await notifyTargets(env);
  if (!targets.length) {
    console.warn("notify: бот ещё не добавлен ни в одну группу и ADMIN_CHAT_ID не задан");
    return new Response("no chat configured", { status: 503, headers });
  }

  const results = await Promise.allSettled(
    targets.map(async (chatId) => ({ chatId, messageId: await sendMessage(env, chatId, text, replyMarkup) })),
  );
  if (results.every((r) => r.status === "rejected")) {
    return new Response("telegram error", { status: 502, headers });
  }
  // Запоминаем сообщения заявки, чтобы удалить их вместе с заявкой в CRM.
  const sent: Array<{ chatId: string; messageId: number }> = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.messageId != null) {
      sent.push({ chatId: r.value.chatId, messageId: r.value.messageId });
    }
  }
  if (body.leadId && sent.length) {
    await env.TG_KV.put(`leadmsg:${body.leadId}`, JSON.stringify(sent), {
      expirationTtl: 60 * 60 * 24 * 180,
    });
  }
  return new Response(JSON.stringify({ ok: true, id }), {
    status: 200,
    headers: { ...headers, "content-type": "application/json" },
  });
}

/** Firebase web API key — публичный конфиг проекта (не секрет). */
const FIREBASE_API_KEY = "AIzaSyCmX0CUAZZ6HCRRNfqXPGMjZRBp3NQvVAI";

/** Проверяет Firebase ID токен и grant adminAccess/{uid} (role=admin, enabled=true). */
async function isAdminToken(env: Env, idToken: string): Promise<boolean> {
  try {
    const lookup = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!lookup.ok) return false;
    const uid = (await lookup.json() as { users?: Array<{ localId?: string }> }).users?.[0]?.localId;
    if (!uid || !env.FIREBASE_SA) return false;

    const token = await getAccessToken(env);
    const project = env.FIREBASE_PROJECT_ID ?? "porfo-ddb46";
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/adminAccess/${uid}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return false;
    const data = await res.json() as {
      fields?: { role?: { stringValue?: string }; enabled?: { booleanValue?: boolean } };
    };
    return data.fields?.role?.stringValue === "admin" && data.fields?.enabled?.booleanValue === true;
  } catch (err) {
    console.error("admin token check failed:", err);
    return false;
  }
}

/** Удаляет сообщения заявки в чатах бота (вызывается админкой после удаления заявки). */
async function handleDeleteLeadMessages(env: Env, req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const headers = cors(env, origin);
  if (!allowedOrigins(env).includes(origin ?? "")) {
    return new Response("forbidden origin", { status: 403, headers });
  }

  const authz = req.headers.get("authorization") ?? "";
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!idToken) return new Response("unauthorized", { status: 401, headers });

  let body: { leadId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400, headers });
  }
  const leadId = String(body.leadId ?? "");
  if (!/^[A-Za-z0-9]{15,}$/.test(leadId)) {
    return new Response("invalid payload", { status: 400, headers });
  }
  if (!(await isAdminToken(env, idToken))) {
    return new Response("forbidden", { status: 403, headers });
  }

  const raw = await env.TG_KV.get(`leadmsg:${leadId}`);
  if (raw) {
    let messages: Array<{ chatId: string; messageId: number }> = [];
    try {
      messages = JSON.parse(raw) as Array<{ chatId: string; messageId: number }>;
    } catch {
      // битое значение — просто забываем связку
    }
    await Promise.allSettled(
      messages.map(async ({ chatId, messageId }) => {
        const res = await tgCall(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
        if (!res.ok) {
          console.warn(`deleteMessage ${chatId}/${messageId} failed: ${res.status} ${await res.text()}`);
        }
      }),
    );
    await env.TG_KV.delete(`leadmsg:${leadId}`);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...headers, "content-type": "application/json" },
  });
}

async function handleWebhook(env: Env, req: Request): Promise<Response> {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== env.TG_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const update = await req.json() as {
      message?: { chat: Chat; text?: string; from?: { id: number } };
      my_chat_member?: { chat: Chat; new_chat_member?: { status?: string } };
    };

    if (update.my_chat_member) {
      const status = update.my_chat_member.new_chat_member?.status;
      if (status === "left" || status === "kicked") {
        await env.TG_KV.delete(`chat:${update.my_chat_member.chat.id}`);
      } else {
        const added = await upsertChat(env, update.my_chat_member.chat);
        if (added && (status === "member" || status === "administrator")) {
          await sendMessage(
            env,
            String(update.my_chat_member.chat.id),
            "✅ Бот подключён. Заявки с сайта будут приходить в этот чат.\n" +
              "Администраторам группы: /login <пароль>, затем /maintenance on|off, /broadcast <текст>.",
          );
        }
      }
      return new Response("ok");
    }

    const msg = update.message;
    if (!msg) return new Response("ok");

    if (msg.chat.type !== "private") await upsertChat(env, msg.chat);

    const chatId = String(msg.chat.id);
    const userId = msg.from?.id;
    const text = (msg.text ?? "").trim();
    if (userId && text.startsWith("/") && await isAuthorized(env, chatId, userId)) {
      await handleCommand(env, text, chatId, userId);
    }
    return new Response("ok");
  } catch (err) {
    console.error("webhook error:", err);
    return new Response("ok");
  }
}

async function handleAdminAnnounce(env: Env, req: Request): Promise<Response> {
  if (req.headers.get("x-admin-secret") !== env.TG_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  let body: { maintenance?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const on = body.maintenance === true;
  await env.TG_KV.put("config:maintenance", String(on));
  await broadcast(env, on
    ? "🔧 Бот обновляется: технические работы. Заявки временно могут не приходить."
    : "✅ Обновление завершено — бот снова принимает заявки.");
  return new Response(JSON.stringify({ ok: true, maintenance: on }), {
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(env, req.headers.get("origin")) });
    }
    if (req.method === "GET" && url.pathname === "/") {
      return new Response("tg-bot ok");
    }
    if (req.method === "POST" && url.pathname === "/notify") {
      return handleNotify(env, req);
    }
    if (req.method === "POST" && url.pathname === "/delete-lead") {
      return handleDeleteLeadMessages(env, req);
    }
    if (req.method === "POST" && url.pathname === "/telegram") {
      return handleWebhook(env, req);
    }
    if (req.method === "POST" && url.pathname === "/admin/announce") {
      return handleAdminAnnounce(env, req);
    }
    return new Response("not found", { status: 404 });
  },
};
