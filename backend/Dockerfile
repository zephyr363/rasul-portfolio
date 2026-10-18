FROM python:3.13-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.9.20 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project
FROM python:3.13-slim
RUN groupadd -r app && useradd -m -r -g app -u 10001 app
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY --chown=app:app . .
RUN mkdir -p /app/media /app/staticfiles && chown -R app:app /app/media /app/staticfiles && chmod +x /app/docker-entrypoint.sh
USER app
RUN DJANGO_SECRET_KEY=build-only-key POSTGRES_PASSWORD=build-only DJANGO_DEBUG=true python manage.py collectstatic --noinput
EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "45", "--graceful-timeout", "30", "--access-logfile", "-", "--error-logfile", "-"]
