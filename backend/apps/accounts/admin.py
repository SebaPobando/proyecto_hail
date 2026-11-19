from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from apps.tenancy.models import Membership

from .models import User


class HailUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ("email",)


class HailUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


class MembershipInline(admin.TabularInline):
    model = Membership
    fk_name = "user"
    extra = 0
    autocomplete_fields = ["organization"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = HailUserChangeForm
    add_form = HailUserCreationForm
    inlines = [MembershipInline]
    ordering = ["email"]
    list_display = ["email", "first_name", "last_name", "is_staff", "is_active", "last_login"]
    list_filter = ["is_staff", "is_active", "memberships__organization"]
    search_fields = ["email", "first_name", "last_name"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Datos personales", {"fields": ("first_name", "last_name")}),
        (
            "Permisos",
            {
                "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions"),
                "description": "«Es staff» convierte a la cuenta en administrador global: ve todos los clientes.",
            },
        ),
        ("Fechas", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),)
