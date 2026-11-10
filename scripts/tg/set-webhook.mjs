// Регистрация Telegram webhook. По умолчанию dry-run (0 сетевых вызовов), сеть только с --apply.
// Секреты — только из env: BOT_TOKEN, WEBHOOK_URL, TG_WEBHOOK_SECRET. Токен не хардкодится и не логируется.
const APPLY = process.argv.includes("--apply");
const ALLOWED_UPDATES = ["message", "my_chat_member"];
const NAMES = ["BOT_TOKEN", "WEBHOOK_URL", "TG_WEBHOOK_SECRET"];

const missing = NAMES.filter((k) => !(process.env[k] || "").trim());
if (missing.length) {
  console.error(`set-webhook: не заданы env: ${missing.join(", ")}`);
  console.error(`  BOT_TOKEN=<токен из @BotFather> WEBHOOK_URL=https://<домен>/api/tg/webhook TG_WEBHOOK_SECRET=<секрет> node scripts/tg/set-webhook.mjs [--apply]`);
  process.exit(1);
}

const token = process.env.BOT_TOKEN.trim();
const url = process.env.WEBHOOK_URL.trim();
const secret = process.env.TG_WEBHOOK_SECRET.trim();

try {
  if (new URL(url).protocol !== "https:") throw new Error("not https");
} catch {
  console.error(`set-webhook: WEBHOOK_URL должен быть валидным https-адресом, получено: ${url}`);
  process.exit(1);
}

const redact = (s) => String(s).split(token).join("<BOT_TOKEN>");
const mask = (s) => "*".repeat(s.length);

const body = { url, secret_token: secret, allowed_updates: ALLOWED_UPDATES };

if (!APPLY) {
  console.log(JSON.stringify({
    mode: "dry-run",
    endpoint: "POST https://api.telegram.org/bot<BOT_TOKEN>/setWebhook",
    payload: { ...body, secret_token: mask(secret) },
  }, null, 2));
  process.exit(0);
}

let res, json;
try {
  res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  json = await res.json();
} catch (e) {
  console.error(`set-webhook: сетевой сбой: ${redact(e.message)}`);
  process.exit(1);
}

if (!res.ok || !json.ok) {
  console.error(`set-webhook: Telegram отклонил запрос: HTTP ${res.status} code=${json.error_code ?? "-"} ${redact(json.description ?? "без описания")}`);
  process.exit(1);
}

console.log(`set-webhook: ok — ${redact(json.description ?? "Webhook was set")} url=${url} allowed_updates=${ALLOWED_UPDATES.join(",")}`);
