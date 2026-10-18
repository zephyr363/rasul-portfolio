#!/bin/sh
# Collect static assets into the shared volume before serving with Gunicorn.
# Other commands (migrate, shell, ...) run unchanged.
set -e

if [ "$1" = "gunicorn" ]; then
  python manage.py collectstatic --noinput
fi

exec "$@"
