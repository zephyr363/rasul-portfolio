import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    pass


class SiteSettings(models.Model):
    hero_title = models.CharField(
        "Заголовок лендинга", max_length=180, default="Технологии, которые работают на ваш бизнес."
    )
    hero_copy = models.TextField("Предложение клиенту", blank=True)
    portrait_main = models.ImageField("Главный портрет", upload_to="profile/", blank=True)
    portrait_detail = models.ImageField(
        "Портрет для раздела о себе", upload_to="profile/", blank=True
    )
    portrait_alt = models.CharField(
        "Описание портрета", max_length=220, default="Расул Ахметов — backend-разработчик"
    )
    profession = models.CharField("Профессия", max_length=120, default="Backend-разработчик")
    phone = models.CharField("Телефон", max_length=40, blank=True)
    work_format = models.CharField("Формат работы", max_length=160, blank=True)
    education = models.TextField("Образование", blank=True)
    languages = models.CharField("Языки", max_length=200, blank=True)
    name = models.CharField("Имя", max_length=120, default="Расул Ахметов")
    tagline = models.CharField(
        "Подпись", max_length=160, default="Python / Java · Backend Developer"
    )
    city = models.CharField("Город", max_length=120, blank=True)
    intro = models.TextField("Вступление", blank=True)
    biography = models.TextField("Биография", blank=True)
    email = models.EmailField("Email", blank=True)
    instagram = models.URLField("Социальная сеть", blank=True)
    seo_title = models.CharField("SEO заголовок", max_length=120, default="Портфолио разработчика")
    seo_description = models.CharField("SEO описание", max_length=300, blank=True)
    site_url = models.URLField("Основной адрес сайта", default="http://localhost:5173")
    demo_mode = models.BooleanField("Предпросмотр (noindex)", default=True)
    google_verification = models.CharField(max_length=160, blank=True)
    bing_verification = models.CharField(max_length=160, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Настройки сайта"
        verbose_name_plural = "Настройки сайта"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return "Контент, параметры и SEO"


class Collection(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField("Название", max_length=100)
    description = models.TextField("Описание", blank=True)
    order = models.PositiveIntegerField("Порядок", default=0)
    published = models.BooleanField("Опубликовано", default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "pk"]
        verbose_name = "Подборка"
        verbose_name_plural = "Подборки"

    def __str__(self):
        return self.title


class Photo(models.Model):
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="photos", verbose_name="Подборка"
    )
    image = models.ImageField("Фото", upload_to="portfolio/%Y/%m/")
    alt = models.CharField("Описание для доступности", max_length=240)
    order = models.PositiveIntegerField("Порядок", default=0)
    featured = models.BooleanField("На главной", default=False)
    published = models.BooleanField("Опубликовано", default=True)

    class Meta:
        ordering = ["order", "pk"]
        verbose_name = "Фотография"
        verbose_name_plural = "Фотографии"

    def __str__(self):
        return self.alt


class ContactRequest(models.Model):
    name = models.CharField("Имя", max_length=120)
    email = models.EmailField("Email")
    project_type = models.CharField("Тип проекта", max_length=80)
    message = models.TextField("Сообщение", max_length=4000)
    consent = models.BooleanField("Согласие", default=False)
    created_at = models.DateTimeField("Получено", auto_now_add=True, db_index=True)
    status = models.CharField(
        "Статус",
        choices=[("new", "Новая"), ("read", "Прочитана"), ("closed", "Закрыта")],
        max_length=10,
        default="new",
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Заявка"
        verbose_name_plural = "Заявки"

    def __str__(self):
        return f"{self.name} — {self.project_type}"


class RefreshSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    current_jti = models.UUIDField(default=uuid.uuid4)
    previous_jti = models.UUIDField(null=True)
    rotated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked = models.BooleanField(default=False)


class Experience(models.Model):
    company = models.CharField("Компания", max_length=180)
    role = models.CharField("Должность", max_length=140)
    city = models.CharField("Город", max_length=100, blank=True)
    start = models.DateField("Начало")
    end = models.DateField("Окончание", null=True, blank=True)
    description = models.TextField("Обязанности и результаты")
    published = models.BooleanField("Опубликовано", default=True)

    class Meta:
        ordering = ["-start"]
        verbose_name = "Опыт работы"
        verbose_name_plural = "Опыт работы"

    def __str__(self):
        return f"{self.company} — {self.role}"


class Service(models.Model):
    title = models.CharField("Направление работы", max_length=120)
    description = models.TextField("Польза для клиента")
    technologies = models.CharField("Технологии через запятую", max_length=250)
    order = models.PositiveIntegerField("Порядок", default=0)
    published = models.BooleanField("Опубликовано", default=True)

    class Meta:
        ordering = ["order", "pk"]
        verbose_name = "Направление работы"
        verbose_name_plural = "Чем могу помочь"

    def __str__(self):
        return self.title


class SkillGroup(models.Model):
    title = models.CharField("Категория", max_length=100)
    skills = models.TextField("Навыки через запятую")
    order = models.PositiveIntegerField("Порядок", default=0)

    class Meta:
        ordering = ["order", "pk"]
        verbose_name = "Группа навыков"
        verbose_name_plural = "Стек и навыки"

    def __str__(self):
        return self.title


class Project(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField("Название", max_length=150)
    summary = models.CharField("Краткое описание", max_length=300)
    description = models.TextField("Задача, решение и результат")
    stack = models.CharField("Стек", max_length=300)
    cover = models.ImageField("Обложка", upload_to="projects/", blank=True)
    url = models.URLField("Сайт проекта", blank=True)
    repository = models.URLField("Репозиторий", blank=True)
    order = models.PositiveIntegerField("Порядок", default=0)
    published = models.BooleanField("Опубликовано", default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "pk"]
        verbose_name = "Проект"
        verbose_name_plural = "Проекты"

    def __str__(self):
        return self.title
