"""Create a local owner with a generated password, without overwriting existing accounts."""
import os
import secrets
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()
from portfolio.models import User

user, created = User.objects.get_or_create(
    username="owner", defaults={"is_staff": True, "is_superuser": True}
)
if created:
    password = secrets.token_urlsafe(24)
    user.set_password(password)
    user.save()
    target = root / ".runtime" / "admin-credentials.txt"
    target.parent.mkdir(exist_ok=True)
    target.write_text(
        "Local development only\nUsername: owner\nPassword: " + password
        + "\nAdmin: http://127.0.0.1:5173/admin/\nStudio: http://127.0.0.1:5173/studio\n",
        encoding="utf-8",
    )
print("Local owner ready. Generated credentials are in .runtime/admin-credentials.txt.")
