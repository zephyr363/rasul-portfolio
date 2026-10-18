from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Collection,
    ContactRequest,
    Experience,
    Photo,
    Project,
    Service,
    SiteSettings,
    SkillGroup,
    User,
)

admin.site.site_header = "Portfolio · Управление"
admin.site.register(User, UserAdmin)


@admin.register(SiteSettings)
class SettingsAdmin(admin.ModelAdmin):
    fieldsets = [
        (
            "Основное",
            {
                "fields": (
                    "demo_mode",
                    "name",
                    "profession",
                    "tagline",
                    "city",
                    "intro",
                    "biography",
                )
            },
        ),
        (
            "Лендинг",
            {
                "fields": (
                    "hero_title",
                    "hero_copy",
                    "portrait_main",
                    "portrait_detail",
                    "portrait_alt",
                )
            },
        ),
        ("Профиль", {"fields": ("work_format", "education", "languages")}),
        ("Контакты", {"fields": ("email", "phone", "instagram")}),
        (
            "SEO",
            {
                "fields": (
                    "site_url",
                    "seo_title",
                    "seo_description",
                    "google_verification",
                    "bing_verification",
                )
            },
        ),
    ]

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class PhotoInline(admin.TabularInline):
    model = Photo
    extra = 0


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("title", "technologies", "order", "published")
    list_editable = ("order", "published")
    search_fields = ("title", "description")


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ["title", "slug", "order", "published"]
    list_editable = ["order", "published"]
    prepopulated_fields = {"slug": ("title",)}
    inlines = [PhotoInline]
    search_fields = ["title"]
    list_filter = ["published"]


@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ["alt", "collection", "order", "featured", "published"]
    list_editable = ["order", "featured", "published"]
    list_filter = ["collection", "featured", "published"]
    search_fields = ["alt"]


@admin.register(ContactRequest)
class ContactAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "project_type", "status", "created_at"]
    list_filter = ["status", "project_type", "created_at"]
    search_fields = ["name", "email", "message"]
    list_editable = ["status"]
    readonly_fields = ["created_at", "consent"]


@admin.register(Experience)
class ExperienceAdmin(admin.ModelAdmin):
    list_display = ("company", "role", "start", "end", "published")
    list_filter = ("published",)
    search_fields = ("company", "role", "description")


@admin.register(SkillGroup)
class SkillAdmin(admin.ModelAdmin):
    list_display = ("title", "skills", "order")
    list_editable = ("order",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "order", "published")
    list_editable = ("order", "published")
    search_fields = ("title", "summary", "stack")
    list_filter = ("published",)
    prepopulated_fields = {"slug": ("title",)}
