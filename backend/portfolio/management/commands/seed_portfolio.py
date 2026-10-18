from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand
from django.db import transaction

from portfolio.models import Collection, Photo, SiteSettings


class Command(BaseCommand):
    help = "Create editable image collections; never overwrite existing settings or photos."

    @transaction.atomic
    def handle(self, *args, **options):
        SiteSettings.objects.get_or_create(pk=1)
        groups = [
            (
                "minimal",
                "Минимализм",
                "Чистые линии, естественная пластика и лаконичный чёрный образ.",
                [("minimal", "Минималистичный образ: чёрный свитер и джинсы", True)],
            ),
            (
                "portraits",
                "Портреты",
                "Портреты при естественном свете: анфас, профиль и детали.",
                [
                    ("portrait", "Портрет анфас при естественном свете", False),
                    ("profile", "Портрет в профиль", False),
                    ("portrait-board", "Подборка портретов в чёрном свитере", False),
                ],
            ),
            (
                "casual",
                "Casual",
                "Белая футболка, свободный деним и непринуждённое настроение.",
                [("casual", "Повседневный образ в белой футболке и джинсах", False)],
            ),
            (
                "editorial",
                "Editorial",
                "Монохромные образы: строгий силуэт, чёрная рубашка и длинное пальто.",
                [
                    ("editorial", "Editorial образ в длинном чёрном пальто", False),
                    ("smart", "Образ в чёрной рубашке и брюках", False),
                ],
            ),
            (
                "tests",
                "Модельные тесты",
                "Ракурсы, ростовые кадры и подборки образов.",
                [
                    ("headshots", "Модельные тесты: восемь ракурсов лица", False),
                    ("tests", "Модельные тесты: портреты и ростовые фотографии", False),
                    ("looks", "Подборка портретов и образов", False),
                    ("styles", "Четыре стилистики: минимализм, casual, smart и editorial", False),
                ],
            ),
        ]
        for order, (slug, title, description, photos) in enumerate(groups):
            collection, _ = Collection.objects.get_or_create(
                slug=slug, defaults={"title": title, "description": description, "order": order}
            )
            for photo_order, (name, alt, featured) in enumerate(photos):
                if Photo.objects.filter(collection=collection, alt=alt).exists():
                    continue
                path = Path(settings.BASE_DIR) / "seed_media" / f"{name}.webp"
                if not path.exists():
                    raise FileNotFoundError(f"Seed image missing: {path}")
                photo = Photo(collection=collection, alt=alt, order=photo_order, featured=featured)
                with path.open("rb") as stream:
                    photo.image.save(path.name, File(stream), save=True)
        self.stdout.write(
            self.style.SUCCESS("Image collections seeded; existing content preserved.")
        )
