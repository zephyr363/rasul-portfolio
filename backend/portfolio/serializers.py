from rest_framework import serializers

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


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        exclude = ["published"]


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillGroup
        fields = ["id", "title", "skills"]


class RelativeImageField(serializers.ImageField):
    def to_representation(self, value):
        return value.url if value else ""


class ProjectSerializer(serializers.ModelSerializer):
    cover = RelativeImageField(read_only=True)

    class Meta:
        model = Project
        exclude = ["published", "order"]


class SiteSerializer(serializers.ModelSerializer):
    portrait_main = RelativeImageField(read_only=True)
    portrait_detail = RelativeImageField(read_only=True)

    class Meta:
        model = SiteSettings
        exclude = ["id"]


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "title", "description", "technologies"]


class PhotoSerializer(serializers.ModelSerializer):
    image = RelativeImageField(read_only=True)

    class Meta:
        model = Photo
        fields = ["id", "image", "alt", "featured", "order"]


class CollectionSerializer(serializers.ModelSerializer):
    photos = PhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Collection
        fields = ["slug", "title", "description", "photos", "updated_at"]


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactRequest
        fields = [
            "id",
            "name",
            "email",
            "project_type",
            "message",
            "consent",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError("Необходимо согласие на обработку заявки.")
        return value

    def validate_message(self, value):
        if len(value.strip()) < 20:
            raise serializers.ValidationError("Опишите проект подробнее (минимум 20 символов).")
        return value.strip()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, max_length=200)


class TokenSerializer(serializers.Serializer):
    access = serializers.CharField()


class UserSerializer(serializers.Serializer):
    username = serializers.CharField()
    is_staff = serializers.BooleanField()
