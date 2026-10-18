# Расул Ахметов — персональное портфолио

Полноценное приложение: Django 6 REST API, PostgreSQL, React Router Framework SSR и редактирование содержимого через Django Admin. Факты профиля взяты из предоставленного резюме от 18.10.2026. Фотографии предоставлены пользователем. Проекты не выдуманы: раздел готов к публикации реальных кейсов через CMS.

## Локальный запуск (Windows / PowerShell)

Требования: Docker Desktop с Linux containers, uv, Node.js **24** (либо >=22.22), npm. Файл `.env` уже создан для текущей рабочей среды с отдельными случайными секретами; он игнорируется Git.

Для новой установки скопируйте `.env.example` в `.env`, задайте случайные `DJANGO_SECRET_KEY` и `POSTGRES_PASSWORD`, включите `DJANGO_DEBUG=true`, укажите `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=55432`, разрешённые localhost-адреса и `CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173`. Production-шаблон `.env.example` намеренно не содержит действующих секретов.

```powershell
docker compose -f docker-compose.dev.yml up -d
. .\scripts\env.ps1
cd backend
uv sync --frozen
uv run python manage.py migrate
uv run python manage.py seed_portfolio
uv run python manage.py load_resume
uv run python manage.py configure_landing
uv run python manage.py createsuperuser
cd ..\frontend
npm ci
```

Запустите в двух отдельных терминалах из корня:

```powershell
.\scripts\dev-backend.ps1
```

```powershell
.\scripts\dev-frontend.ps1
```

Сайт: http://127.0.0.1:5173 · Django Admin: http://127.0.0.1:5173/admin/ · Кабинет: http://127.0.0.1:5173/studio.

В текущей рабочей среде создан локальный суперпользователь `owner`. Сгенерированный пароль находится в `.runtime/admin-credentials.txt` (не входит в Git). Для другой среды создавайте собственную учётную запись через `createsuperuser`. Автоматической публичной регистрации нет.

## Управление контентом

- **Настройки сайта**: имя, профессия, подпись, город, биография, вступление, форматы работы, образование, языки, контакты, URL сайта, метаданные и коды верификации поисковых систем.
- **Опыт работы**: компания, должность, даты, обязанности, видимость.
- **Стек и навыки**: категории, технологии и порядок.
- **Проекты**: название, описание, стек, изображение, ссылки, slug и публикация. Черновики не доступны через публичный API.
- **Лендинг** в настройках сайта: заголовок, предложение клиенту, главный и дополнительный портрет.
- **Чем могу помочь**: направления работы, описания, технологии, порядок и видимость.
- Публичная фотогалерея удалена. Старые референсы остаются в базе для сохранности.
- **Заявки**: поиск, статусы и фильтры. Контактная форма сохраняет данные в PostgreSQL; отправка email не включена.

Команды `seed_portfolio` и `load_resume` повторно не перезаписывают заполненный профиль, фотографии и записи опыта. Для изменения содержимого используйте админку. Исходные изображения уже оптимизированы в `backend/seed_media`; повторный доступ к Downloads не нужен.

## Проверки

```powershell
. .\scripts\env.ps1
cd backend
uv run python manage.py check
uv run python manage.py test
uv run ruff check .
uv run python manage.py spectacular --validate --file ..\docs\openapi.yml
cd ..\frontend
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2E требует запущенных dev-серверов и установленного Chrome. Тест входа включается через `E2E_USERNAME` и `E2E_PASSWORD`; не указывайте пароль аргументом команды. Тесты формы создают записи с email `e2e@example.com`, которые можно удалить в админке. Для изоляции используйте отдельную БД. Backend-тесты автоматически используют отдельную тестовую БД PostgreSQL.

## Ветки и CI

`prod` — стабильная ветка для выпусков, `dev` — интеграционная. Изменения попадают в `dev` через Pull Request. GitHub Actions (`.github/workflows/ci.yml`) на каждый push и PR в `prod`/`dev` запускает: `ruff check`, `manage.py check`, тесты Django с PostgreSQL, валидацию OpenAPI, `npm run typecheck`, `npm test` и production-сборку.

## Архитектура и безопасность

Публичные страницы получают данные Django в SSR-loader. При недоступном API возвращается 503, для отсутствующих проектов/подборок — 404. Заглушки вместо backend не используются. Redux store создаётся отдельно для каждого SSR-запроса. RTK Query управляет клиентскими запросами, формами, авторизацией и кешем кабинета.

Публичные страницы SSR обращаются к API по внутренней сети Docker, поэтому внешний rate limit настроен на уровне Traefik (`ratelimit@file`: 20 req/s со всплеском до 40) и не объединяет посещения в один лимит. Swagger (`/api/docs/`) и OpenAPI-схема (`/api/schema/`) доступны только staff-пользователю. Устаревшие эндпоинты фотогалереи помечены в схеме как `deprecated`.

Access JWT живёт 10 минут и хранится только в памяти Redux. Refresh JWT находится в HttpOnly cookie с узким Path. Ротация выполняется под блокировкой строки PostgreSQL, предыдущий токен принимается 5 секунд для конкурентных запросов. Single-flight и Web Locks защищают обновление на клиенте. Logout отзывает серверную сессию, очищает cookie и кеш, уведомляет другие вкладки без передачи токенов. Backend проверяет отзыв сессии и для уже выпущенных access-токенов. CSRF включён для login/refresh/logout и контактной формы. Throttling использует общий кеш в PostgreSQL; Redis для текущего объёма задач не нужен.

Публичные факты не включают дату рождения и прочие ненужные сведения из резюме. Настройка «Предпросмотр (noindex)» включена до задания реального домена. В этом режиме robots запрещает индексацию, sitemap пуст. В рабочем режиме формируются canonical, Open Graph, динамический sitemap, JSON-LD WebSite/Person и хлебные крошки. `/llms.txt` — дополнительный экспериментальный файл; индексация и цитирование AI-поиском не гарантируются. Сторонние трекеры не подключены.

Развёртывание и резервные копии: [docs/deployment.md](docs/deployment.md). Решения по структуре: [docs/architecture.md](docs/architecture.md). Фактические результаты проверок: [docs/verification.md](docs/verification.md).

Новый дизайн Serif и обновление существующей установки: [docs/serif-redesign.md](docs/serif-redesign.md).
