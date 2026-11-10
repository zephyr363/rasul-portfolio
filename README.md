# Rasul Akhmetov — Portfolio

Одностраничный портфолио-сайт Расула Ахметова: услуги для МСБ, кейсы, контакты. Языки: RU (основной), KZ, EN с переключателем (сохраняется в localStorage).

Сайт: https://zephyr363.github.io/rasul-portfolio/

## Стек

- Vite + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix UI)
- SPA с React Router: публичная страница и Firebase CMS/CRM в `/admin`
- Дизайн v2: тёмная тема с лаймовым акцентом (макет: `.ai/previews/mockup-v2.html`)

## Команды

| Команда | Что делает |
|---|---|
| `npm install` | Установка зависимостей |
| `npm run dev` | Dev-сервер Vite на http://localhost:5180 |
| `npm run build` | Проверка контента и типов, production-сборка в `dist/` с base `/rasul-portfolio/` |
| `npm run build:pages` | Локальная сборка и подготовка `docs/` для Pages; без публикации |
| `npm run check:pages` | Проверка готового `docs/`: assets, маршруты и отсутствие sourcemaps |
| `npm run preview` | Просмотр собранной версии |
| `npm run lint` | Проверка типов (`tsc --noEmit`) |
| `npm run validate:content` | Проверка контента (`scripts/validate-content.mjs`) по контрактам |
| `npm run release:check` | Полный релиз-конвейер (`node scripts/verify-release.mjs`) |

## Тесты

| Команда | Что проверяет | Кол-во |
|---|---|---|
| `npm test` | Unit/component-тесты vitest (`src/**/*.test.*`) | 189 |
| `npm run test:rules` | Firestore Rules через локальный emulator | — |

`npm run release:check` включает validate-content, `npm test` и проверку типов. Сборка и проверка Pages выполняются отдельно: `npm run build:pages`.

## Структура

```
src/
  components/   секции сайта и UI (shadcn/ui)
  lib/          логика (кейсы, i18n, контакты, locales-адаптер, утилиты)
  assets/       изображения (фото CEO — производная 68.5 KB)
  styles/       глобальные стили Tailwind
content/
  cases.json          источник истины для кейсов
  cases-contract.mjs  контракт формата кейсов
  locales.json        источник истины для текстов сайта (ru / kz / en)
  locales-contract.mjs контракт формата locales.json
admin/
  content-store.mjs   хранилище CMS: ревизии sha256, атомарные записи
  publication.mjs     read-only статус git относительно origin/prod
scripts/
  validate-content.mjs, check-docs.mjs, verify-release.mjs
docs/           собранный сайт (артефакт GitHub Pages, не править руками)
admin-server.js единая платформа CMS+CRM (локальный сервер)
admin.html      UI платформы
.ai/            память проекта и служебные материалы команды
```

Telegram-бот заявок (Cloud Functions + Firestore, секреты, деплой, приёмка): [TG-BOT.md](TG-BOT.md).

Тексты сайта теперь живут в `content/locales.json`, адаптер — `src/lib/locales.ts`. Старые `src/content/locales/*.ts` удалены (миграция на единый JSON-документ).

## Архив: прежняя локальная платформа CMS+CRM

Ниже описан legacy-инструмент, который больше не входит в текущие npm-команды. Текущая Firebase CMS/CRM открывается в dev по http://localhost:5180/admin/login и в production по адресу из раздела «Релиз».

`admin-server.js` и `admin.html` — один локальный инструмент с четырьмя вкладками:

- **Заявки** — CRM: заявки с сайта.
- **Кейсы** — редактирование `content/cases.json`.
- **Тексты сайта** — редактирование `content/locales.json`.
- **Публикация** — статус git-изменений и запуск локальной проверки релиза.

Запуск:

```bash
# Windows (PowerShell)
$env:ADMIN_PASSWORD = "..."
npm run admin
```

- Нужна переменная окружения `ADMIN_PASSWORD`: без неё сервер не запустится.
- Адрес: http://127.0.0.1:3210 (порт меняется через `ADMIN_PORT`), только loopback.
- Заявки хранятся вне репозитория: по умолчанию `%LOCALAPPDATA%\rasul-portfolio\leads.json` (Windows) или `~/.local/share/rasul-portfolio/leads.json`; путь задаётся `CRM_DATA_DIR`.
- Сохранение кейса или текстов записывает файлы в `content/`, но **не публикует сайт**. Публикация — только через релиз (см. ниже).

### CMS-редактор текстов (вкладка «Тексты сайта»)

- Документ `content/locales.json`: `{ "version": 1, "locales": { "ru", "kz", "en" } }`.
- Правится только то, что разрешает контракт `content/locales-contract.mjs`: строки в заданных лимитах длины и значения из фиксированного whitelist ключей.
- Массивы фиксированной длины: элементы можно менять, но **нельзя добавлять и удалять**. Длина и ключи совпадают у ru/kz/en по построению.
- Сохранение использует ревизии (sha256): если файл изменён параллельно, сервер отвечает 409; некорректные данные — 400. Запись атомарная.

### Публикация (вкладка «Публикация»)

Порядок работы:

1. **Verify** — кнопка запускает `scripts/verify-release.mjs` локально (`POST /api/publication/verify`). Одновременно может идти только один job: при занятости сервер отвечает 409, запуск принят — 202.
2. **Commit вручную** — платформа не делает commit и не делает push. Статус (`GET /api/publication/status`) показывает: `changed` (незакоммиченные изменения в `content/` или `docs/`), `committed_not_pushed`, `clean` или `unknown`, а также список файлов и число прочих изменений.
3. **Разрешение CEO** — публикация возможна только после отдельного явного разрешения CEO. Статус `CEO_APPROVED` сам по себе не означает деплой.
4. **Push** — `git push` в `prod` вручную, после разрешения CEO.

## Тесты и локальный просмотр

```bash
npm install
npm run dev
```

Открыть http://localhost:5180. Production preview: `npm run preview`, затем `/rasul-portfolio/` на адресе, выведенном Vite.

## Релиз

1. `npm run release:check` — контракты контента, unit/component-тесты и проверка типов.
2. `npm run build:pages` — production-сборка в `dist/`, копирование в `docs/`, `.nojekyll`, `404.html` и directory entrypoints для `/admin/`, `/admin/login/`, `/admin/leads/`, `/admin/cases/`, `/admin/content/`, `/admin/settings/`; автоматическая проверка артефакта. Существующий `docs/` заменяется только при наличии маркера генератора; чужой каталог не удаляется.
3. Коммит изменений (вручную).
4. Публикация (`git push`) — только по отдельному явному разрешению CEO. Одобрение `CEO_APPROVED` само по себе не означает деплой.

Публикация — вручную через GitHub Pages, без GitHub Actions. Текущий production обслуживает legacy-корень ветки `prod`; подготовка `docs/` сама его не меняет. После отдельного разрешения CEO нужно включить сгенерированный `docs/` в коммит, отправить разрешённые изменения и вручную выбрать Settings → Pages → Deploy from a branch → `prod` → `/docs` → Save. Смена источника и push не входят в `build:pages`.

Публичный URL: https://zephyr363.github.io/rasul-portfolio/ . Вход: https://zephyr363.github.io/rasul-portfolio/admin/login/ . Известные directory routes возвращают entrypoint со статусом 200 (Pages может добавить завершающий `/`); неизвестные пути используют `404.html` со статусом 404, затем клиентский роутер возвращает на главную. Auth continue URL учитывает `/rasul-portfolio/`; authorized domains Firebase проверяются вручную и сборкой не меняются.

## Язык

Основной язык контента и интерфейса — русский. Тексты KZ и EN лежат в `content/locales.json` вместе с RU.
