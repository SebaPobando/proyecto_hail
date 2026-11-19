"""Modelo multitenant de Hail.

Organización = cliente (unidad de aislamiento). Un usuario accede a los
proyectos de las organizaciones donde tiene una membresía. El administrador
global (usuario staff) no necesita membresías: ve todo.
"""

from django.conf import settings
from django.db import models


class Organization(models.Model):
    name = models.CharField("nombre", max_length=120)
    slug = models.SlugField("identificador", max_length=60, unique=True)
    is_active = models.BooleanField(
        "activa", default=True, help_text="Si se desactiva, sus usuarios dejan de ver sus proyectos."
    )
    created_at = models.DateTimeField("creada", auto_now_add=True)

    class Meta:
        verbose_name = "organización (cliente)"
        verbose_name_plural = "organizaciones (clientes)"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Membership(models.Model):
    class Role(models.TextChoices):
        VIEWER = "viewer", "Lector"
        OPERATOR = "operator", "Operador"
        ORG_ADMIN = "org_admin", "Administrador del cliente"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships", verbose_name="usuario"
    )
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships", verbose_name="organización"
    )
    role = models.CharField("rol", max_length=20, choices=Role.choices, default=Role.VIEWER)
    created_at = models.DateTimeField("creada", auto_now_add=True)

    class Meta:
        verbose_name = "membresía"
        verbose_name_plural = "membresías"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "organization"], name="membership_unique_user_org"),
        ]

    def __str__(self) -> str:
        return f"{self.user} · {self.organization} ({self.get_role_display()})"
