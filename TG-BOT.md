# Telegram-бот заявок (Cloudflare Workers)

Уведомления о заявках с сайта и админ-команды. Бесплатный план Cloudflare Workers — **без карты**.

- Код бота: `tg-bot/worker.ts`
- Конфиг (CLI-вариант): `wrangler.toml`
- Вызов из формы: `src/data/leads.ts` (после записи заявки в Firestore)
- Регистрация вебхука: `scripts/tg/set-webhook.mjs`

## Как включить (бот сам начинает работу)

1. Создайте бота у @BotFather (если ещё нет) — получите токен.
2. Разверните Worker (ниже) и задайте `BOT_TOKEN` + `TG_WEBHOOK_SECRET`.
3. Зарегистрируйте вебхук (URL + `/telegram`).
4. **Добавьте бота в Telegram-группу** — он запомнит чат, напишет «Бот подключён», и заявки начнут приходить туда.
5. Команды доступны **администраторам группы**.

`ADMIN_CHAT_ID` не обязателен — только если хотите дублировать заявки в личку.

## Архитектура

```
Форма сайта → Firestore (leads, для CRM)
            └→ POST <worker>/notify → Telegram (все группы, где есть бот)
Telegram → POST <worker>/telegram (команды, авто-регистрация групп)
```

- Заявка всегда сохраняется в Firestore → CRM не меняется.
- Telegram-уведомление вторично: его сбой не ломает создание заявки.
- Состояние — Workers KV (`TG_KV`): `chat:*` (реестр), `config:maintenance`, `rl:*`.

## Переменные и биндинги

| Имя | Тип | Назначение |
|---|---|---|
| `BOT_TOKEN` | Secret | Токен из @BotFather |
| `TG_WEBHOOK_SECRET` | Secret | Сверяется с `X-Telegram-Bot-Api-Secret-Token`; не совпал — `401` |
| `ADMIN_CHAT_ID` | Secret (необязательно) | Дублировать заявки в личку / разрешить команды оттуда |
| `ALLOWED_ORIGIN` | Var | Домены формы через запятую (`https://zephyr363.github.io,http://localhost:5180`) |
| `TG_KV` | KV binding | Хранилище состояния |

Фронтенд (build-time, GitHub repo variable):
`VITE_TG_NOTIFY_URL=https://<worker>.workers.dev/notify`

Секреты в репозиторий не попадают.

## Сообщение о заявке

```
🔔 Новая заявка с сайта

id: {uuid}
👤 Имя: {name}
📞 Телефон: {phone}
🕒 Дата: {date}
```

`id` — UUID v4, генерируется при создании заявки — для распознавания сообщения.
`parse_mode=HTML`, значения экранируются, дата — `Asia/Almaty`, при `429` — один повтор.

## Команды (администраторы группы или `ADMIN_CHAT_ID`)

| Команда | Действие |
|---|---|
| `/start` | Проверка, что бот на связи |
| `/maintenance on` | Рассылка «техработы» всем чатам + флаг |
| `/maintenance off` | Рассылка «работа возобновлена» |
| `/broadcast <текст>` | Шаблонное сообщение во все чаты (≤ 4000 символов) |

Группы запоминаются автоматически (добавление бота, сообщения в группе), удаление бота — чат убирается из рассылки.

## Деплой (dashboard, без CLI)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → Worker.
2. Вставить содержимое `tg-bot/worker.ts` (модульный синтаксис поддерживается).
3. **Settings → Variables and Secrets**: добавить `BOT_TOKEN` (secret), `TG_WEBHOOK_SECRET` (secret), `ALLOWED_ORIGIN` (var), при желании `ADMIN_CHAT_ID`.
4. **Settings → Bindings → KV namespace**: создать namespace `TG_KV` и привязать как `TG_KV`.
5. Deploy → получить URL `https://<worker>.workers.dev`.
6. Зарегистрировать вебхук:

```bash
BOT_TOKEN=<токен> WEBHOOK_URL=https://<worker>.workers.dev/telegram TG_WEBHOOK_SECRET=<секрет> \
  node scripts/tg/set-webhook.mjs --apply
```

7. Добавить бота в группу — он зарегистрирует чат сам.
8. Собрать сайт с `VITE_TG_NOTIFY_URL=https://<worker>.workers.dev/notify` и опубликовать.

### Деплой через CLI (альтернатива)

```bash
npx wrangler login
npx wrangler secret put BOT_TOKEN
npx wrangler secret put TG_WEBHOOK_SECRET
npx wrangler deploy        # id KV namespace указать в wrangler.toml
```

## Чек-лист приёмки

1. Добавить бота в группу → приходит «Бот подключён»; тестовая заявка → сообщение с `id: <uuid>`.
2. `/maintenance on` → рассылка; `/maintenance off` → рассылка о возобновлении.
3. `/broadcast тест` → сообщение в группу.
4. Команда от обычного участника игнорируется.
5. `POST /telegram` без secret-token → `401`.
6. Сбой `/notify` не мешает заявке появиться в CRM.

## Безопасность

- Токен — только в Secrets Cloudflare; в репозитории/клиенте его нет.
- Если токен засветился — перевыпустить у @BotFather и обновить `BOT_TOKEN`, затем повторить `setWebhook`.
- `/notify` публичен (вызов из браузера): проверка Origin, валидация полей, rate-limit по IP.

## Альтернатива (не используется)

`functions/` + `firebase.json` — Cloud Functions 2nd gen с Firestore-триггером. Требует Blaze (предоплата $30 для карт KZ). Код оставлен на случай апгрейда.
