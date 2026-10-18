from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .auth import COOKIE, decode, encode
from .models import Collection, ContactRequest, Photo, RefreshSession, Service, SiteSettings, User


@override_settings(DEBUG=True, SECURE_SSL_REDIRECT=False)
class LandingContentTests(TestCase):
    def test_only_published_services_are_returned_in_order(self):
        Service.objects.create(
            title="Second", description="Second service", technologies="Java", order=2
        )
        Service.objects.create(
            title="First", description="First service", technologies="Python", order=1
        )
        Service.objects.create(
            title="Draft", description="Not public", technologies="Python", published=False
        )
        response = APIClient().get("/api/v1/services/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["title"] for item in response.json()], ["First", "Second"])

    def test_landing_content_and_portraits_come_from_editable_settings(self):
        site = SiteSettings.objects.create(
            name="Test",
            hero_title="Custom headline",
            hero_copy="Custom proposition",
            portrait_main="profile/main.webp",
            portrait_detail="profile/detail.webp",
        )
        client = APIClient()
        result = client.get("/api/v1/site/").json()
        self.assertEqual(result["portrait_main"], "/media/profile/main.webp")
        self.assertEqual(result["hero_title"], "Custom headline")
        site.hero_title = "Updated in CMS"
        site.save()
        self.assertEqual(client.get("/api/v1/site/").json()["hero_title"], "Updated in CMS")


@override_settings(DEBUG=True, SECURE_SSL_REDIRECT=False)
class ApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            "owner", password="strong-test-password", is_staff=True
        )
        SiteSettings.objects.create(name="CMS Name", demo_mode=True)

    def csrf(self, client=None):
        return (client or self.client).get("/api/v1/auth/csrf/").json()["csrfToken"]

    def login(self):
        return self.client.post(
            "/api/v1/auth/login/",
            {"username": "owner", "password": "strong-test-password"},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )

    def test_login_requires_csrf(self):
        response = self.client.post(
            "/api/v1/auth/login/", {"username": "owner", "password": "strong-test-password"}
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.login().status_code, 200)

    def test_cookie_rotation_logout_and_revocation(self):
        response = self.login()
        self.assertEqual(set(response.json()), {"access"})
        cookie = response.cookies[COOKIE]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], "/api/v1/auth/")
        old_refresh = cookie.value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 200)
        refreshed = self.client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=self.csrf())
        self.assertEqual(refreshed.status_code, 200)
        self.assertNotEqual(refreshed.cookies[COOKIE].value, old_refresh)
        self.assertEqual(
            self.client.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=self.csrf()).status_code, 204
        )
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)
        self.client.cookies[COOKIE] = old_refresh
        self.assertEqual(
            self.client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=self.csrf()).status_code, 401
        )

    def test_concurrent_tab_rotation_grace_and_replay_expiry(self):
        self.login()
        old = self.client.cookies[COOKIE].value
        new = (
            self.client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=self.csrf())
            .cookies[COOKIE]
            .value
        )
        self.client.cookies[COOKIE] = old
        second = self.client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=self.csrf())
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.cookies[COOKIE].value, new)
        RefreshSession.objects.update(rotated_at=timezone.now() - timedelta(seconds=10))
        self.client.cookies[COOKIE] = old
        self.assertEqual(
            self.client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=self.csrf()).status_code, 401
        )

    def test_csrf_origin_validation_and_refresh_logout_protection(self):
        self.login()
        for path in ["refresh", "logout"]:
            self.assertEqual(self.client.post(f"/api/v1/auth/{path}/").status_code, 403)
            self.assertEqual(
                self.client.post(
                    f"/api/v1/auth/{path}/",
                    HTTP_X_CSRFTOKEN=self.csrf(),
                    HTTP_ORIGIN="https://evil.example",
                ).status_code,
                403,
            )

    def test_expired_access_can_be_refreshed(self):
        access = self.login().json()["access"]
        payload = decode(access, "access")
        payload["exp"] = timezone.now() - timedelta(seconds=5)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {encode(payload)}")
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)
        self.assertEqual(
            self.client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=self.csrf()).status_code, 200
        )

    def test_staff_only_and_disabled_user(self):
        self.user.is_staff = False
        self.user.save()
        self.assertEqual(self.login().status_code, 401)
        self.user.is_staff = True
        self.user.save()
        self.login()
        self.user.is_active = False
        self.user.save()
        self.assertEqual(
            self.client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=self.csrf()).status_code, 401
        )

    def test_contact_validation_and_private_inbox(self):
        payload = {
            "name": "Test",
            "email": "test@example.com",
            "project_type": "Editorial",
            "message": "An actual project description for a real database test.",
            "consent": True,
        }
        self.assertEqual(
            self.client.post("/api/v1/contact/", payload, format="json").status_code, 403
        )
        bad = {**payload, "consent": False}
        self.assertEqual(
            self.client.post(
                "/api/v1/contact/", bad, format="json", HTTP_X_CSRFTOKEN=self.csrf()
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                "/api/v1/contact/", payload, format="json", HTTP_X_CSRFTOKEN=self.csrf()
            ).status_code,
            201,
        )
        self.assertEqual(ContactRequest.objects.count(), 1)
        self.assertEqual(self.client.get("/api/v1/inbox/").status_code, 401)
        access = self.login().json()["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        result = self.client.get("/api/v1/inbox/?search=Test&status=new&ordering=created_at").json()
        self.assertEqual(result["count"], 1)
        self.assertEqual(self.client.get("/api/v1/inbox/?search=absent").json()["count"], 0)

    def test_cms_visibility_and_missing_collection(self):
        published = Collection.objects.create(title="Public", slug="public")
        Collection.objects.create(title="Hidden", slug="hidden", published=False)
        Photo.objects.create(collection=published, image="sample.webp", alt="Visible")
        Photo.objects.create(
            collection=published, image="hidden.webp", alt="Hidden", published=False
        )
        result = self.client.get("/api/v1/collections/").json()
        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0]["photos"]), 1)
        self.assertEqual(self.client.get("/api/v1/collections/hidden/").status_code, 404)
        self.assertEqual(self.client.get("/api/v1/site/").json()["name"], "CMS Name")

    @override_settings(DEBUG=False)
    def test_production_cookie_secure(self):
        self.assertTrue(self.login().cookies[COOKIE]["secure"])

    def test_api_docs_are_restricted_to_staff(self):
        anonymous = APIClient()
        self.assertEqual(anonymous.get("/api/schema/").status_code, 401)
        self.assertEqual(anonymous.get("/api/docs/").status_code, 401)
        access = self.login().json()["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(self.client.get("/api/schema/").status_code, 200)
        self.assertEqual(self.client.get("/api/docs/").status_code, 200)

    def test_login_throttle(self):
        token = self.csrf()
        for _ in range(10):
            self.client.post(
                "/api/v1/auth/login/",
                {"username": "none", "password": "bad"},
                HTTP_X_CSRFTOKEN=token,
            )
        self.assertEqual(
            self.client.post(
                "/api/v1/auth/login/",
                {"username": "none", "password": "bad"},
                HTTP_X_CSRFTOKEN=token,
            ).status_code,
            429,
        )
