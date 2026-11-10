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
    "Access-Control-Allow-Headers": "content-type",
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

async function sendMessage(env: Env, chatId: string, text: string): Promise<void> {
  let res = await tgCall(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after")) * 1000;
    await new Promise((r) => setTimeout(r, Number.isFinite(retry) && retry > 0 ? retry : 1500));
    res = await tgCall(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
  }
  if (!res.ok) throw new Error(`sendMessage ${res.status}: ${await res.text()}`);
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

async function handleCommand(env: Env, text: string, chatId: string): Promise<void> {
  const [command, ...args] = text.split(/\s+/);
  const arg = args.join(" ").trim();
  switch (command) {
    case "/start":
      await sendMessage(env, chatId, "🤖 Бот заявок на связи. Заявки с сайта приходят в эту группу.");
      return;
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

  let body: { id?: string; name?: string; phone?: string };
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

  const results = await Promise.allSettled(targets.map((chatId) => sendMessage(env, chatId, text)));
  if (results.every((r) => r.status === "rejected")) {
    return new Response("telegram error", { status: 502, headers });
  }
  return new Response(JSON.stringify({ ok: true, id }), {
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
              "Команды для администраторов группы: /maintenance on|off, /broadcast <текст>.",
          );
        }
      }
      return new Response("ok");
    }

    const msg = update.message;
    if (!msg) return new Response("ok");

    if (msg.chat.type !== "private") await upsertChat(env, msg.chat);

    const chatId = String(msg.chat.id);
    const text = (msg.text ?? "").trim();
    if (text.startsWith("/") && await isAuthorized(env, chatId, msg.from?.id)) {
      await handleCommand(env, text, chatId);
    }
    return new Response("ok");
  } catch (err) {
    console.error("webhook error:", err);
    return new Response("ok");
  }
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
    if (req.method === "POST" && url.pathname === "/telegram") {
      return handleWebhook(env, req);
    }
    return new Response("not found", { status: 404 });
  },
};
