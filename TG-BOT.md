# Telegram-бот заявок (Cloudflare Workers)

Уведомления о заявках с сайта, кнопка WhatsApp и управление статусами. Бесплатный план Cloudflare Workers — **без карты**.

- Код бота: `tg-bot/worker.ts`
- Конфиг: `wrangler.toml`
- Вызов из формы: `src/data/leads.ts` (после записи заявки в Firestore)
- Деплой с авто-объявлением: `scripts/tg/deploy-bot.mjs` (`npm run deploy:bot`)
- Регистрация вебхука: `scripts/tg/set-webhook.mjs`

## Как включить

1. Создайте бота у @BotFather — получите токен.
2. Разверните Worker (ниже), задайте секреты `BOT_TOKEN`, `TG_WEBHOOK_SECRET`, `BOT_ADMIN_PASSWORD`.
3. Зарегистрируйте вебхук (URL + `/telegram`).
4. **Добавьте бота в Telegram-группу** — он запомнит чат и начнёт присылать заявки.
5. В группе: `/login <пароль>` (администратор группы), затем команды.

`ADMIN_CHAT_ID` не обязателен — только для дублирования заявок в личку.

## Архитектура

```
Форма → Firestore (все заявки, CRM — источник истины)
      └→ POST <worker>/notify → Telegram (группы + кнопка WhatsApp)
Telegram → POST <worker>/telegram (вход, команды, авто-регистрация групп)
Смена статуса: бот → Firestore REST (сервисный аккаунт)
Деплой: announce(on) → wrangler deploy → announce(off)
```

- Заявка всегда пишется в Firestore; Telegram — вторичный канал.
- `/notify` сохраняет связку `uuid → id документа Firestore` (KV, 180 дней).
- Состояние — Workers KV: `chat:*`, `config:maintenance`, `rl:*`, `auth:*`, `lead:*`.

## Переменные и биндинги

| Имя | Тип | Назначение |
|---|---|---|
| `BOT_TOKEN` | Secret | Токен из @BotFather |
| `TG_WEBHOOK_SECRET` | Secret | Проверка `X-Telegram-Bot-Api-Secret-Token`; он же admin-secret для `/admin/announce` |
| `BOT_ADMIN_PASSWORD` | Secret | Пароль для `/login` в боте |
| `FIREBASE_SA` | Secret | JSON сервисного аккаунта (для `/changeLeadStatus`) |
| `FIREBASE_PROJECT_ID` | Var (опц.) | По умолчанию `porfo-ddb46` |
| `ADMIN_CHAT_ID` | Secret (опц.) | Дублировать заявки в личку |
| `ALLOWED_ORIGIN` | Var | `https://zephyr363.github.io,http://localhost:5180` |
| `TG_KV` | KV binding | Состояние |

Фронтенд (build-time): `VITE_TG_NOTIFY_URL=https://<worker>.workers.dev/notify`.

## Сообщение о заявке

```
🔔 Новая заявка с сайта

id: {uuid}
👤 Имя: {name}
📞 Телефон: {phone}
🕒 Дата: {date}
```

Под сообщением — кнопка **«💬 Написать в WhatsApp»**: открывает `wa.me/<номер>?text=Здравствуйте! Пишу по вашей заявке с сайта.`

## Команды

Вход: `/login <пароль>` (только администратор группы или `ADMIN_CHAT_ID`), сессия 12 ч, `/logout`.
Без входа команды отвечают «Нужен вход».

| Команда | Действие |
|---|---|
| `/start` | Проверка связи |
| `/login <пароль>` | Вход (12 часов) |
| `/logout` | Выход |
| `/maintenance on\|off` | Рассылка «техработы» / «возобновлено» |
| `/broadcast <текст>` | Рассылка во все чаты (≤ 4000 символов) |
| `/changeLeadStatus <id> <new\|in_progress\|done\|spam>` | Меняет статус заявки в Firestore |

`<id>` — `id: <uuid>` из сообщения о заявке (или id документа Firestore).

## Деплой

Через скрипт (сам объявляет техработы до и после):

```bash
WORKER_URL=https://<worker>.workers.dev TG_WEBHOOK_SECRET=<секрет> npm run deploy:bot
```

Или вручную: `npx wrangler deploy` (без авто-объявления).

Секреты:

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put TG_WEBHOOK_SECRET
npx wrangler secret put BOT_ADMIN_PASSWORD
npx wrangler secret put FIREBASE_SA    # ключ сервисного аккаунта (JSON)
```

Вебхук:

```bash
BOT_TOKEN=<токен> WEBHOOK_URL=https://<worker>.workers.dev/telegram TG_WEBHOOK_SECRET=<секрет> \
  node scripts/tg/set-webhook.mjs --apply
```

## Сервисный аккаунт (для смены статуса)

Firebase Console → Project settings → Service accounts → **Generate new private key** → JSON-файл.
Загрузить целиком: `Get-Content key.json -Raw | npx wrangler secret put FIREBASE_SA`.
Доступ к Firestore — по правам сервисного аккаунта (правила клиентов не применяются).

## Чек-лист приёмки

1. Бот добавлен в группу → «Бот подключён»; заявка → сообщение с `id: <uuid>` и кнопкой WhatsApp.
2. `/login <пароль>` → «Вход выполнен»; без входа команды недоступны.
3. `/changeLeadStatus <uuid> done` → статус в Firestore/CRM изменился.
4. `/maintenance on|off` → рассылки; `/broadcast тест` → сообщение в группу.
5. `npm run deploy:bot` → перед деплоем «техработы», после — «обновление завершено».
6. `POST /telegram` без secret-token → `401`.
7. Сбой `/notify` не мешает заявке появиться в CRM.

## Безопасность

- Токен, пароль бота и ключ сервисного аккаунта — только в Secrets Cloudflare.
- Команды: администратор группы/`ADMIN_CHAT_ID` + вход по паролю (сессия 12 ч).
- `/notify` публичен: проверка Origin, валидация, rate-limit по IP.
- При утечке токена — перевыпустить у @BotFather и обновить секрет.

## Альтернатива (не используется)

`functions/` + `firebase.json` — Cloud Functions 2nd gen. Требует Blaze (предоплата $30 для карт KZ).
