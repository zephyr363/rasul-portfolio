from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand

from portfolio.models import Service, SiteSettings


class Command(BaseCommand):
    help = "Configure the serif landing page and its editable services and portraits."

    def handle(self, *args, **options):
        site = SiteSettings.objects.get(pk=1)
        if not site.hero_copy:
            site.hero_copy = "Помогаю создавать и развивать серверную часть приложений: от REST API и интеграций до автоматизации рабочих процессов. Python, Java и внимание к вашей задаче."
        for field, filename in [
            ("portrait_main", "rasul-professional-2k.webp"),
            ("portrait_detail", "rasul-portrait-2k.webp"),
        ]:
            path = Path(settings.BASE_DIR) / "seed_media" / filename
            if path.exists() and not getattr(site, field):
                with path.open("rb") as stream:
                    getattr(site, field).save(filename, File(stream), save=False)
        site.save()
        for order, (title, description, technologies) in enumerate(
            [
                (
                    "Backend-разработка",
                    "Серверная логика для вашего приложения: работа с данными, бизнес-процессами и фоновыми задачами. Разработка новых функций и поддержка существующего кода.",
                    "Python, Django, FastAPI, Java, Spring Boot",
                ),
                (
                    "REST API и интеграции",
                    "API для взаимодействия ваших систем. Понятные контракты, работа с базами данных и обмен информацией между приложениями.",
                    "REST API, PostgreSQL, Redis",
                ),
                (
                    "Автоматизация процессов",
                    "Меньше повторяющихся действий при разработке и выпуске продукта. Настройка сборки, контейнеризации и процессов CI/CD.",
                    "Docker, CI/CD, GitLab, Celery",
                ),
            ]
        ):
            Service.objects.get_or_create(
                title=title,
                defaults={"description": description, "technologies": technologies, "order": order},
            )
        self.stdout.write(
            self.style.SUCCESS("Landing content configured. Existing customizations preserved.")
        )
