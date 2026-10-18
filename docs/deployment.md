# Развёртывание на VPS

Нужны Linux VPS, Docker Engine/Compose, домен и DNS A/AAAA, направленные на сервер. Разрешите 80/443 и SSH; базу данных наружу не открывайте. Текущая локальная `.env` предназначена для разработки, не переносите её в production.

## Первая установка

1. Скопируйте проект на сервер. Создайте `.env` из `.env.example`, задайте криптографически случайные секреты, реальный DOMAIN и ACME_EMAIL. Установите DJANGO_DEBUG=false, DJANGO_ALLOWED_HOSTS=`ваш-домен,backend,localhost`, CSRF_TRUSTED_ORIGINS=`https://ваш-домен`. Не сохраняйте `.env` в Git.
2. Соберите образы и запустите БД:

```sh
docker compose build
docker compose up -d postgres
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py seed_portfolio
docker compose run --rm backend python manage.py load_resume
docker compose run --rm backend python manage.py configure_landing
docker compose run --rm backend python manage.py createsuperuser
docker compose run --rm backend python manage.py check --deploy
docker compose up -d
docker compose ps
docker compose logs --tail=100 backend frontend traefik
```

Static files собираются при сборке backend-образа; медиа живут в persistent volume. Команды миграций выполняются отдельно, а не параллельно в каждом worker. Gunicorn использует три worker, timeout 45 сек. и graceful timeout 30 сек.; настройте число workers по памяти VPS.

3. Откройте `https://ваш-домен/admin/`. В настройках сайта задайте `site_url=https://ваш-домен`, проверьте профиль и контакты, утвердите условия обработки данных, затем выключите «Предпросмотр (noindex)». Добавьте только реальные проекты. При необходимости заполните коды верификации Google/Bing.
4. Проверьте TLS, перенаправление HTTP→HTTPS, `/api/health/`, фото, форму, вход/выход, `/robots.txt`, `/sitemap.xml`, canonical и 404. Let's Encrypt требует доступного DNS и порта 80. Без реального домена выпуск сертификата нельзя считать проверенным.

`security` middleware содержит CSP для React SSR hydration. В текущей конфигурации inline scripts разрешены: для более строгого CSP нужен отдельный nonce-проход в SSR. Dashboard Traefik не включён. Не выставляйте backend или SSR порт напрямую наружу — маршрутизация и proxy headers рассчитаны на Traefik.

## Обновление и откат

1. Сохраните резервную копию базы и медиа. Запишите текущий git commit и идентификаторы работающих образов (`docker compose images`). Сохраните прежние образы под отдельными тегами; не запускайте prune до проверки обновления.
2. Подготовьте новый checkout, выполните тесты и `docker compose build`. Проверьте совместимость миграций. На время несовместимых изменений остановите приём заявок.
3. Выполните миграции отдельным `docker compose run --rm backend python manage.py migrate`, затем `docker compose up -d --no-deps backend frontend media`.
4. Проверьте healthchecks и основные сценарии. При ошибке верните предыдущий checkout и образ. Если миграция несовместима с предыдущим кодом, восстановите согласованную копию БД и медиа. Не откатывайте БД поверх новых заявок без их предварительного сохранения.

## Резервное копирование

Из корня проекта на Linux:

```sh
mkdir -p backups
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/database.dump
docker compose run --rm --no-deps -v "$PWD/backups:/backup" backend tar -czf /backup/media.tar.gz -C /app/media .
```

Для записи архива при запуске от непривилегированного пользователя каталог backups должен быть ему доступен. Храните зашифрованные копии за пределами VPS; отдельно сохраняйте `.env` и сертификаты. Срок хранения заявок определите до публичного запуска. Проверяйте восстановление на отдельной среде.

Восстановление на подготовленную чистую БД (остановите backend/frontend на время восстановления):

```sh
docker compose stop backend frontend
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backups/database.dump
docker compose run --rm --no-deps -v "$PWD/backups:/backup:ro" backend tar -xzf /backup/media.tar.gz -C /app/media
docker compose up -d backend frontend
```

Архив медиа должен соответствовать копии БД. Не удаляйте volumes командой `down -v` при обычных обновлениях.

## Границы готовности

Email-уведомления и внешняя аналитика не подключены. Новые заявки доступны в кабинете и админке. Реальные кейсы нужно заполнить владельцу. DNS, production HTTPS, внешняя индексация и полевые показатели производительности проверяются после развёртывания на реальном сервере. Никакие результаты AI-поиска не заявлены.
