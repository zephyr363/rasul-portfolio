. (Join-Path $PSScriptRoot 'env.ps1')
Push-Location (Join-Path $PSScriptRoot '..\backend')
try { uv run python manage.py runserver 127.0.0.1:8000 --noreload } finally { Pop-Location }
