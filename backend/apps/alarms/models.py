"""Reglas de alarma por señal y registro de alarmas.

Una regla compara la lectura actual de una señal con un umbral. Cada vez que
la condición se cumple nace una `Alarm`, que sigue el ciclo de ISA-18.2:

    activa sin reconocer → activa reconocida → normalizada (cerrada)
    activa sin reconocer → normalizada sin reconocer → reconocida (cerrada)

Una alarma queda abierta mientras esté activa o falte reconocerla.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Priority(models.TextChoices):
    HIGH = "high", "Alta"
    MEDIUM = "medium", "Media"
    LOW = "low", "Baja"


PRIORITY_RANK = {Priority.HIGH: 0, Priority.MEDIUM: 1, Priority.LOW: 2}


class AlarmRule(models.Model):
    """Regla sobre una señal (alto, bajo, estado) o sobre un dispositivo (sin comunicación)."""

    class Condition(models.TextChoices):
        HIGH = "high", "Alto: valor ≥ umbral"
        LOW = "low", "Bajo: valor ≤ umbral"
        STATE = "state", "Estado: valor = umbral"
        COMM = "comm", "Sin comunicación: sin datos del dispositivo por más de «umbral» segundos"

    SIGNAL_CONDITIONS = {Condition.HIGH, Condition.LOW, Condition.STATE}

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="alarm_rules", editable=False
    )
    signal = models.ForeignKey(
        "projects.Signal",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="alarm_rules",
        verbose_name="señal",
        help_text="Para alto, bajo o estado.",
    )
    device = models.ForeignKey(
        "projects.Device",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="alarm_rules",
        verbose_name="dispositivo",
        help_text="Solo para «sin comunicación».",
    )
    condition = models.CharField("condición", max_length=10, choices=Condition.choices)
    threshold = models.FloatField(
        "umbral", help_text="En estados, el número del estado (ej. 2 = Falla). En comunicación, segundos sin datos."
    )
    deadband = models.FloatField(
        "banda muerta",
        default=0.0,
        help_text=(
            "Histéresis para normalizar: un alto se normaliza bajo umbral − banda; "
            "un bajo, sobre umbral + banda. Evita que la alarma parpadee cerca del umbral. Solo alto y bajo."
        ),
    )
    on_delay = models.PositiveIntegerField(
        "persistencia (s)",
        default=0,
        help_text="La condición debe mantenerse este tiempo antes de activar la alarma. 0 = inmediata. "
        "Filtra picos breves. No aplica a comunicación, cuyo umbral ya es un tiempo.",
    )
    priority = models.CharField("prioridad", max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    message = models.CharField(
        "mensaje",
        max_length=200,
        blank=True,
        help_text="Qué significa y qué hacer. Ej.: Cloro bajo: revisar dosificadora.",
    )
    is_enabled = models.BooleanField(
        "habilitada", default=True, help_text="Al deshabilitarla se normalizan sus alarmas activas."
    )
    # Estado interno de la persistencia: desde cuándo se cumple la condición sin haber activado aún.
    pending_since = models.DateTimeField(null=True, blank=True, editable=False)
    created_at = models.DateTimeField("creada", auto_now_add=True)
    updated_at = models.DateTimeField("modificada", auto_now=True)

    class Meta:
        verbose_name = "regla de alarma"
        verbose_name_plural = "reglas de alarma"
        ordering = ["project__name", "pk"]
        constraints = [
            models.CheckConstraint(
                condition=Q(signal__isnull=False, device__isnull=True) | Q(signal__isnull=True, device__isnull=False),
                name="alarmrule_signal_xor_device",
            )
        ]

    def __str__(self):
        return f"{self.subject} {self.describe()}"

    def save(self, *args, **kwargs):
        source = self.signal or self.device
        if source is not None:
            self.project_id = source.project_id
        super().save(*args, **kwargs)
        if not self.is_enabled:
            self.alarms.filter(cleared_at__isnull=True).update(cleared_at=timezone.now())

    @property
    def subject(self) -> str:
        """Tag de la señal o código del dispositivo."""
        return self.signal.tag if self.signal_id else self.device.code

    @property
    def unit(self) -> str:
        if self.condition == self.Condition.COMM:
            return "s"
        return self.signal.unit if self.signal_id else ""

    def describe(self) -> str:
        if self.condition == self.Condition.COMM:
            return f"sin datos por más de {self.threshold:g} s"
        if self.condition == self.Condition.STATE:
            label = self.signal.state_labels.get(str(int(self.threshold))) if self.signal.state_labels else None
            return f"= {label or f'estado {self.threshold:g}'}"
        unit = f" {self.signal.unit}" if self.signal.unit else ""
        symbol = "≥" if self.condition == self.Condition.HIGH else "≤"
        return f"{symbol} {self.threshold:g}{unit}".replace(".", ",")  # coma decimal, como en las pantallas

    def clean(self):
        errors = {}
        if self.condition == self.Condition.COMM:
            if not self.device_id or self.signal_id:
                errors["device"] = "Una regla de comunicación se aplica a un dispositivo, sin señal."
            if self.threshold < 10:
                errors["threshold"] = "Usa al menos 10 segundos: los equipos envían datos cada algunos segundos."
        elif self.condition:
            if not self.signal_id or self.device_id:
                errors["signal"] = "Esta condición se aplica a una señal, sin dispositivo."
            if self.condition == self.Condition.STATE and self.threshold != int(self.threshold):
                errors["threshold"] = "Un estado es un número entero."
        if self.deadband < 0:
            errors["deadband"] = "La banda muerta no puede ser negativa."
        if errors:
            raise ValidationError(errors)


class AlarmQuerySet(models.QuerySet):
    def open(self):
        """Activas o pendientes de reconocer."""
        return self.filter(Q(cleared_at__isnull=True) | Q(acknowledged_at__isnull=True))


class Alarm(models.Model):
    class State(models.TextChoices):
        ACTIVE_UNACK = "active_unack", "Activa sin reconocer"
        ACTIVE_ACK = "active_ack", "Activa reconocida"
        CLEARED_UNACK = "cleared_unack", "Normalizada sin reconocer"
        CLOSED = "closed", "Cerrada"

    rule = models.ForeignKey(AlarmRule, on_delete=models.PROTECT, related_name="alarms", verbose_name="regla")
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="alarms", verbose_name="proyecto"
    )
    raised_at = models.DateTimeField("activada", db_index=True)
    raise_value = models.FloatField(
        "valor al activarse",
        null=True,
        blank=True,
        help_text="En comunicación: segundos sin datos (vacío si nunca envió).",
    )
    simulated = models.BooleanField("con datos simulados", default=False)
    cleared_at = models.DateTimeField("normalizada", null=True, blank=True)
    clear_value = models.FloatField("valor al normalizarse", null=True, blank=True)
    acknowledged_at = models.DateTimeField("reconocida", null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="reconocida por",
    )
    ack_comment = models.CharField("comentario", max_length=500, blank=True)

    objects = AlarmQuerySet.as_manager()

    class Meta:
        verbose_name = "alarma"
        verbose_name_plural = "alarmas"
        ordering = ["-raised_at"]
        indexes = [models.Index(fields=["project", "-raised_at"], name="alarm_project_recent")]
        constraints = [
            models.UniqueConstraint(
                fields=["rule"], condition=Q(cleared_at__isnull=True), name="alarm_one_active_per_rule"
            )
        ]

    def __str__(self):
        return f"{self.rule} · {self.raised_at:%Y-%m-%d %H:%M}"

    @property
    def state(self) -> str:
        if self.cleared_at is None:
            return self.State.ACTIVE_ACK if self.acknowledged_at else self.State.ACTIVE_UNACK
        return self.State.CLOSED if self.acknowledged_at else self.State.CLEARED_UNACK
