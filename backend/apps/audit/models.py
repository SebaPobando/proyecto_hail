from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Registro inmutable de acciones relevantes: accesos, cambios de permisos, etc."""

    created_at = models.DateTimeField("fecha", auto_now_add=True, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="actor",
    )
    action = models.CharField("acción", max_length=80, db_index=True)
    organization = models.ForeignKey(
        "tenancy.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="organización",
    )
    target_type = models.CharField("tipo de objeto", max_length=80, blank=True)
    target_id = models.CharField("id de objeto", max_length=64, blank=True)
    target_repr = models.CharField("objeto", max_length=200, blank=True)
    data = models.JSONField("datos", default=dict, blank=True)

    class Meta:
        verbose_name = "registro de auditoría"
        verbose_name_plural = "registros de auditoría"
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} · {self.action}"
