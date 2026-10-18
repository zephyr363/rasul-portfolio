import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .authentication import decode, encode
from .models import RefreshSession
from .serializers import LoginSerializer, TokenSerializer, UserSerializer

COOKIE = "portfolio_refresh"
COOKIE_PATH = "/api/v1/auth/"


def tokens(session):
    access = encode(
        {
            "sub": str(session.user_id),
            "sid": str(session.pk),
            "type": "access",
            "exp": timezone.now() + timedelta(seconds=settings.ACCESS_SECONDS),
        }
    )
    refresh = encode(
        {
            "sub": str(session.user_id),
            "sid": str(session.pk),
            "type": "refresh",
            "jti": str(session.current_jti),
            "exp": int(session.expires_at.timestamp()),
        }
    )
    response = Response({"access": access})
    response.set_cookie(
        COOKIE,
        refresh,
        max_age=max(0, int((session.expires_at - timezone.now()).total_seconds())),
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        path=COOKIE_PATH,
    )
    response["Cache-Control"] = "no-store"
    return response


@method_decorator(csrf_protect, name="dispatch")
class CookieAuthView(APIView):
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def get_authenticate_header(self, request):
        return "Bearer"


class CsrfView(APIView):
    authentication_classes = []

    @extend_schema(
        responses={200: {"type": "object", "properties": {"csrfToken": {"type": "string"}}}}
    )
    def get(self, request):
        response = Response({"csrfToken": get_token(request)})
        response["Cache-Control"] = "no-store"
        return response


class LoginView(CookieAuthView):
    @extend_schema(request=LoginSerializer, responses=TokenSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None or not user.is_staff:
            raise AuthenticationFailed("Проверьте логин и пароль.")
        session = RefreshSession.objects.create(
            user=user, expires_at=timezone.now() + timedelta(seconds=settings.REFRESH_SECONDS)
        )
        return tokens(session)


class RefreshView(CookieAuthView):
    @extend_schema(request=None, responses=TokenSerializer)
    def post(self, request):
        payload = decode(request.COOKIES.get(COOKIE), "refresh")
        with transaction.atomic():
            try:
                session = RefreshSession.objects.select_for_update().get(
                    pk=payload["sid"],
                    user_id=payload["sub"],
                    revoked=False,
                    expires_at__gt=timezone.now(),
                    user__is_active=True,
                )
                token_jti = uuid.UUID(payload["jti"])
            except (RefreshSession.DoesNotExist, ValueError, KeyError):
                raise AuthenticationFailed("Сессия завершена.") from None
            if token_jti == session.current_jti:
                session.previous_jti = session.current_jti
                session.current_jti = uuid.uuid4()
                session.rotated_at = timezone.now()
                session.save(update_fields=["previous_jti", "current_jti", "rotated_at"])
            elif not (
                token_jti == session.previous_jti
                and (timezone.now() - session.rotated_at).total_seconds() < 5
            ):
                raise AuthenticationFailed("Недействительный refresh token.")
            return tokens(session)


class LogoutView(CookieAuthView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        try:
            payload = decode(request.COOKIES.get(COOKIE), "refresh")
            RefreshSession.objects.filter(pk=payload["sid"], user_id=payload["sub"]).update(
                revoked=True
            )
        except AuthenticationFailed:
            pass
        response = Response(status=204)
        response.delete_cookie(COOKIE, path=COOKIE_PATH, samesite="Lax")
        response["Cache-Control"] = "no-store"
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        response = Response(UserSerializer(request.user).data)
        response["Cache-Control"] = "no-store"
        return response
