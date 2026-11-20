"""Bitácora compartida: seguimientos (revisiones, intervenciones) por proyecto.

Cada cambio deja un evento con autor y hora, para que el equipo vea quién hizo
qué. Un seguimiento puede nacer de una alarma.
"""

from django.conf import settings
from django.db import models


class WorkItem(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        IN_PROGRESS = "in_progress", "En atención"
        RESOLVED = "resolved", "Resuelto"

    class Priority(models.TextChoices):
        NORMAL = "normal", "Normal"
        HIGH = "high", "Alta"

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="work_items", verbose_name="proyecto"
    )
    asset = models.CharField(
        "equipo", max_length=40, blank=True, help_text="Tag del equipo. Vacío = instalación general."
    )
    title = models.CharField("asunto", max_length=160)
    priority = models.CharField("prioridad", max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField("estado", max_length=12, choices=Status.choices, default=Status.PENDING)
    owner = models.CharField("responsable", max_length=100, blank=True)
    due_date = models.DateField("fecha objetivo", null=True, blank=True)
    alarm = models.ForeignKey(
        "alarms.Alarm",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_items",
        verbose_name="alarma de origen",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+", verbose_name="creado por"
    )
    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("actualizado", auto_now=True)

    class Meta:
        verbose_name = "seguimiento"
        verbose_name_plural = "seguimientos"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["project", "status"], name="workitem_project_status")]

    def __str__(self):
        return self.title


class WorkItemEvent(models.Model):
    class Kind(models.TextChoices):
        CREATED = "created", "Creado"
        CHANGE = "change", "Cambio"
        NOTE = "note", "Nota"

    item = models.ForeignKey(WorkItem, on_delete=models.CASCADE, related_name="events", verbose_name="seguimiento")
    kind = models.CharField("tipo", max_length=10, choices=Kind.choices)
    text = models.CharField("texto", max_length=1500)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+", verbose_name="autor"
    )
    created_at = models.DateTimeField("fecha", auto_now_add=True)

    class Meta:
        verbose_name = "evento de seguimiento"
        verbose_name_plural = "eventos de seguimiento"
        ordering = ["created_at", "pk"]

    def __str__(self):
        return f"{self.get_kind_display()}: {self.text[:60]}"
