from django.contrib import admin
from django.db.models import Count

from apps.projects.models import Project

from .models import Membership, Organization


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    autocomplete_fields = ["user"]


class ProjectInline(admin.TabularInline):
    model = Project
    extra = 0
    fields = ["name", "slug", "hmi_type", "status", "is_active"]
    show_change_link = True


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_active", "project_count", "member_count", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ["name"]}
    inlines = [ProjectInline, MembershipInline]

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(_projects=Count("projects", distinct=True), _members=Count("memberships", distinct=True))
        )

    @admin.display(description="proyectos", ordering="_projects")
    def project_count(self, obj):
        return obj._projects

    @admin.display(description="usuarios", ordering="_members")
    def member_count(self, obj):
        return obj._members


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role", "created_at"]
    list_filter = ["role", "organization"]
    search_fields = ["user__email", "organization__name"]
    autocomplete_fields = ["user", "organization"]
    list_select_related = ["user", "organization"]
