# Проверка реализации — 18 октября 2026

## Выполнено

| Проверка | Результат |
|---|---|
| Django 6 / Python 3.13 / PostgreSQL | Миграции применены, API и CMS запущены |
| Backend | 10 тестов прошли: CSRF, Origin, JWT, rotation/grace, logout/revocation, permissions, throttling, validation, фильтры |
| Frontend auth | 5 Vitest-тестов прошли: изоляция Redux, конкурентные 401 и один refresh, очистка кеша, ошибка сети, однократный retry |
| Браузер | Все 5 Playwright-сценариев прошли; последний сценарий авторизации перепроверен после улучшения проверки 401 |
| SSR | Контент профиля, metadata и опубликованные подборки доступны без JavaScript |
| Галерея | Фильтры, диалог, клавиатурные стрелки и Escape работают |
| Форма | Клиентская валидация, CSRF-запрос и сохранение в PostgreSQL проверены |
| Сессия | Вход, F5, HttpOnly, отсутствие токенов в browser storage, 401 retry, выход в другой вкладке проверены |
| Адаптивность | 375, 768, 1440, 1920 px; переполнений на главной нет, мобильная навигация работает |
| TypeScript / сборка | strict typecheck и production React Router SSR build прошли |
| Ruff / Django checks | Прошли; `check --deploy` с DEBUG=false без предупреждений |
| OpenAPI | Schema сгенерирована и прошла validation |
| Docker | Многоэтапные образы backend/frontend собраны с lock-файлами |
| Production topology | Изолированный Compose-проект с Gunicorn, SSR, PostgreSQL, Nginx и Traefik запущен локально |
| HTTPS smoke | Локальный TLS, routing, headers, media, CSRF, Secure HttpOnly login, private inbox, logout revocation проверены |
| CMS → SSR | Изменение имени через реальный Django Admin отображается на главной без правки исходников; значение восстановлено |

Скриншоты проверки находятся в игнорируемом каталоге `.runtime/`: `home-desktop.png`, `home-mobile.png`, `production-desktop.png`. Тестовые заявки E2E из рабочей базы удалены после проверки.

После smoke-проверки её отдельные контейнеры остановлены; рабочая dev-база и локальный предпросмотр сохранены. Тестовые volumes сохранены без удаления данных.

## Обнаружено и исправлено

- Node.js 22.13 не соответствует React Router 8: использован доступный Node 24, production Docker также использует Node 24.
- Циклический импорт DRF authentication: JWT authentication выделен из модуля API views.
- Cookie-auth ошибки должны возвращать 401; CSRF-ошибки остаются 403.
- Изображения API должны иметь относительные адреса, чтобы внутренний hostname Docker не попадал в браузер.
- Мобильный заголовок опыта с CTA вызывал переполнение: элементы размещены вертикально.
- Healthcheck Nginx использовал IPv6 localhost при IPv4 listener: адрес заменён на 127.0.0.1.
- Новому Gunicorn нужен доступный домашний каталог пользователя: Docker user создаётся с home.
- Vitest и Playwright разделены по `*.test.ts` / `*.spec.ts`.
- Read-only CMS endpoints освобождены от общего анонимного API-лимита, который иначе объединял бы SSR-запросы всех посетителей под внутренним IP frontend. Запись заявок и auth сохраняют throttling.

## Не подтверждено в локальной среде

Реальный домен, публичный VPS и сертификат Let's Encrypt не настроены. Локальный smoke использует тестовый сертификат Traefik, а не ACME-сертификат. Внешняя индексация и цитирование AI-поиском не проверены. Полевые LCP/INP/CLS и Lighthouse score не заявляются. Уведомления email и аналитика не включены. Юридический текст требует заполнения условий владельца перед публичным запуском. Публикация реальных кейсов доступна через CMS.

## Хардненинг и подготовка репозитория (18 октября 2026)

- Git-репозиторий инициализирован, созданы ветки `prod` и `dev`; добавлены `.gitattributes` (LF для исходников, CRLF для `.ps1`) и расширен `.gitignore` (секреты, артефакты сборки, IDE/ОС).
- Добавлен CI (`.github/workflows/ci.yml`): ruff, `manage.py check`, тесты Django с сервисом PostgreSQL, валидация OpenAPI, typecheck, Vitest и production-сборка фронтенда.
- `/api/docs/` и `/api/schema/` закрыты для staff-пользователя; добавлен автотест ограничения доступа.
- Обязательные переменные окружения (`DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`) проверяются с понятной ошибкой вместо `KeyError`.
- `configure_landing` использует `get_or_create` и не падает на пустой базе.
- `/experience` получил отдельный loader и больше не запрашивает проекты и услуги.
- Traefik: middleware `ratelimit` для внешних `/api/`, `/admin/`, `/static/`. Контейнеры получили ротацию логов и лимиты памяти.
- Устаревшие эндпоинты фотогалереи помечены `deprecated` в OpenAPI; данные сохранены.
