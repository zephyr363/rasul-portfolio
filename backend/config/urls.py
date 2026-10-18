from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from portfolio import auth, views

urlpatterns = [
    path("api/v1/services/", views.ServiceList.as_view()),
    path("api/v1/experience/", views.ExperienceList.as_view()),
    path("api/v1/skills/", views.SkillList.as_view()),
    path("api/v1/projects/", views.ProjectList.as_view()),
    path("api/v1/projects/<slug:slug>/", views.ProjectDetail.as_view()),
    path("admin/", admin.site.urls),
    path("api/health/", views.health),
    path("api/v1/site/", views.SiteView.as_view()),
    path("api/v1/collections/", views.CollectionList.as_view()),
    path("api/v1/collections/<slug:slug>/", views.CollectionDetail.as_view()),
    path("api/v1/contact/", views.ContactCreate.as_view()),
    path("api/v1/inbox/", views.Inbox.as_view()),
    path("api/v1/auth/csrf/", auth.CsrfView.as_view()),
    path("api/v1/auth/login/", auth.LoginView.as_view()),
    path("api/v1/auth/refresh/", auth.RefreshView.as_view()),
    path("api/v1/auth/logout/", auth.LogoutView.as_view()),
    path("api/v1/auth/me/", auth.MeView.as_view()),
    path("api/schema/", SpectacularAPIView.as_view(permission_classes=[auth.IsAuthenticated])),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
urlpatterns[-2].name = "schema"
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
