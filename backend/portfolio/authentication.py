import jwt
from django.conf import settings
from django.utils import timezone
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import RefreshSession


def encode(payload):
    return jwt.encode(
        {**payload, "iss": settings.JWT_ISSUER, "aud": "portfolio"},
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def decode(token, kind):
    try:
        data = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            issuer=settings.JWT_ISSUER,
            audience="portfolio",
            options={"require": ["exp", "sub", "type", "sid"]},
        )
        if data["type"] != kind:
            raise AuthenticationFailed("Недействительная сессия.")
        return data
    except (jwt.PyJWTError, TypeError, ValueError):
        raise AuthenticationFailed("Недействительная или истёкшая сессия.") from None


class AccessAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        payload = decode(header[7:], "access")
        try:
            session = RefreshSession.objects.select_related("user").get(
                pk=payload["sid"],
                user_id=payload["sub"],
                revoked=False,
                expires_at__gt=timezone.now(),
                user__is_active=True,
            )
        except (RefreshSession.DoesNotExist, ValueError):
            raise AuthenticationFailed("Сессия завершена.") from None
        return session.user, payload

    def authenticate_header(self, request):
        return "Bearer"


class BearerScheme(OpenApiAuthenticationExtension):
    target_class = "portfolio.authentication.AccessAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
