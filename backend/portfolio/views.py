from django.db import connection
from django.db.models import Prefetch, Q
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import (
    Collection,
    ContactRequest,
    Experience,
    Photo,
    Project,
    Service,
    SiteSettings,
    SkillGroup,
)
from .serializers import (
    CollectionSerializer,
    ContactSerializer,
    ExperienceSerializer,
    ProjectSerializer,
    ServiceSerializer,
    SiteSerializer,
    SkillSerializer,
)


class ExperienceList(generics.ListAPIView):
    throttle_classes = ()
    serializer_class = ExperienceSerializer
    queryset = Experience.objects.filter(published=True)
    pagination_class = None


class SkillList(generics.ListAPIView):
    throttle_classes = ()
    serializer_class = SkillSerializer
    queryset = SkillGroup.objects.all()
    pagination_class = None


class ProjectList(generics.ListAPIView):
    throttle_classes = ()
    serializer_class = ProjectSerializer
    queryset = Project.objects.filter(published=True)
    pagination_class = None


class ProjectDetail(generics.RetrieveAPIView):
    throttle_classes = ()
    serializer_class = ProjectSerializer
    queryset = ProjectList.queryset
    lookup_field = "slug"


def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return JsonResponse({"status": "ok"})


class ServiceList(generics.ListAPIView):
    serializer_class = ServiceSerializer
    queryset = Service.objects.filter(published=True)
    pagination_class = None
    throttle_classes = ()


class SiteView(APIView):
    throttle_classes = ()

    @extend_schema(responses=SiteSerializer)
    def get(self, request):
        site = generics.get_object_or_404(SiteSettings, pk=1)
        return Response(SiteSerializer(site).data)


class CollectionList(generics.ListAPIView):
    throttle_classes = ()
    serializer_class = CollectionSerializer
    pagination_class = None
    queryset = Collection.objects.filter(published=True).prefetch_related(
        Prefetch("photos", queryset=Photo.objects.filter(published=True))
    )


class CollectionDetail(generics.RetrieveAPIView):
    throttle_classes = ()
    serializer_class = CollectionSerializer
    lookup_field = "slug"
    queryset = CollectionList.queryset


@method_decorator(csrf_protect, name="dispatch")
class ContactCreate(generics.CreateAPIView):
    serializer_class = ContactSerializer
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"


class Inbox(generics.ListAPIView):
    serializer_class = ContactSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = ContactRequest.objects.all()
        if status := self.request.query_params.get("status"):
            qs = qs.filter(status=status)
        if search := self.request.query_params.get("search"):
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(message__icontains=search)
            )
        if self.request.query_params.get("ordering") == "created_at":
            qs = qs.order_by("created_at")
        return qs
