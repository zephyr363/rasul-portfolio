from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from portfolio.models import Experience, SiteSettings, SkillGroup


class Command(BaseCommand):
    help = "Load verified resume content dated October 18, 2026. Preserve existing professional content."

    @transaction.atomic
    def handle(self, *args, **options):
        site, _ = SiteSettings.objects.get_or_create(pk=1)
        if site.name in ("Александр", "Portfolio") or not site.intro:
            values = {
                "name": "Расул Ахметов",
                "profession": "Backend-разработчик",
                "tagline": "Python / Java · Backend Developer",
                "city": "Астана, Казахстан",
                "phone": "+7 (708) 5480859",
                "email": "rasulakhmetov2004@gmail.com",
                "work_format": "Удалённо · Гибрид · В офисе",
                "education": "КарТУ имени А. Сагинова, 2025. Информационные технологии — Системы информационной безопасности.",
                "languages": "Казахский — родной; Английский — B1",
                "intro": "Разрабатываю серверную часть приложений на Python и Java. REST API, базы данных и автоматизация процессов разработки.",
                "biography": "Я Расул Ренатұлы Ахметов, backend-разработчик из Астаны. Работаю с Python, Django, FastAPI, Java и Spring Boot.\n\nМой опыт включает разработку и поддержку серверных приложений, тестирование, ревью кода, автоматизацию сборки и развёртывания. В QAZPOST DIGITAL работаю Java-разработчиком. Ранее руководил IT-отделом архива города Астаны и занимался backend-разработкой в Digital Solutions.\n\nРассматриваю полную, частичную занятость и проектную работу. Доступны удалённый, гибридный и офисный форматы в Астане.",
                "seo_title": "Backend-разработчик · Python и Java",
                "seo_description": "Расул Ахметов — backend-разработчик из Астаны. Python, Django, FastAPI, Java, Spring Boot, PostgreSQL, Docker. Опыт работы и контакты.",
            }
            for key, value in values.items():
                setattr(site, key, value)
            site.save()
        jobs = [
            (
                "QAZPOST DIGITAL",
                "Java-разработчик",
                "",
                date(2026, 9, 1),
                None,
                "Разработка и обслуживание серверной части приложения.\nТестирование кода, исправление ошибок и анализ их причин.\nКонтроль версий и ревью кода других разработчиков.",
            ),
            (
                "State Archive of the City of Astana",
                "Head of IT Department",
                "Астана",
                date(2026, 3, 1),
                date(2026, 8, 1),
                "Определение потенциала автоматизации бизнес-процессов.\nУправление работой команды IT-архитектуры.\nРазработка серверной части и поддержка автоматизированных систем IT-инфраструктуры.",
            ),
            (
                "ТОО Digital Solutions",
                "Backend Developer",
                "Караганда",
                date(2025, 1, 1),
                date(2025, 12, 1),
                "Разработка и поддержка серверной части приложения.\nИсправление ошибок.\nАвтоматизация разработки, сборки и развёртывания ПО, внедрение и поддержка CI/CD.",
            ),
        ]
        for company, role, city, start, end, description in jobs:
            Experience.objects.get_or_create(
                company=company,
                start=start,
                defaults={"role": role, "city": city, "end": end, "description": description},
            )
        for order, (title, skills) in enumerate(
            [
                (
                    "Backend",
                    "Python, Django, Django REST Framework, FastAPI, Java, Spring Boot, REST API",
                ),
                ("Данные и фоновые задачи", "PostgreSQL, Redis, Celery"),
                (
                    "Инфраструктура и качество",
                    "Docker, Kubernetes, Pytest, Git, GitLab, GitHub, CI/CD",
                ),
                ("Frontend", "React"),
            ]
        ):
            SkillGroup.objects.get_or_create(
                title=title, defaults={"skills": skills, "order": order}
            )
        self.stdout.write(
            self.style.SUCCESS("Resume content loaded. Customize all entries in Django Admin.")
        )
