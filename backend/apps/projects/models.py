"""Proyectos (instalaciones), dispositivos de campo y señales.

Regla de aislamiento: todo acceso a datos de un proyecto desde la API pasa
por `Project.objects.for_user(user)`. No consultes `Project.objects.all()`
en código que responda a un usuario.
"""

from django.core.validators import RegexValidator
from django.db import models
from django.db.models import OuterRef, Subquery

from apps.tenancy.models import Membership, Organization


class ProjectQuerySet(models.QuerySet):
    def for_user(self, user):
        """Proyectos que `user` puede ver.

        - Anónimo o inactivo: ninguno.
        - Administrador global (staff): todos, incluidos los inactivos.
        - Resto: proyectos activos de organizaciones activas donde tiene membresía.
        """
        if user is None or not user.is_authenticated or not user.is_active:
            return self.none()
        if user.is_platform_admin:
            return self.all()
        member_of = Membership.objects.filter(user=user).values("organization_id")
        return self.filter(is_active=True, organization__is_active=True, organization_id__in=member_of)

    def with_user_role(self, user):
        """Anota `user_role`: el rol del usuario en la organización de cada proyecto."""
        role = Membership.objects.filter(user_id=user.pk, organization_id=OuterRef("organization_id")).values("role")
        return self.annotate(user_role=Subquery(role[:1]))


class Project(models.Model):
    class HmiType(models.TextChoices):
        AGUAPOZO = "aguapozo", "Agua potable (AguaPozo)"
        NUTRIAL = "nutrial", "Proceso Nutrial"
        ELECTRICAL = "electrical", "Medidores eléctricos"
        GENERIC = "generic", "Genérica (tabla de señales)"

    class Status(models.TextChoices):
        DEVELOPMENT = "development", "En desarrollo"
        DEMO = "demo", "Demostración"
        LIVE = "live", "En operación"

    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="projects", verbose_name="organización"
    )
    slug = models.SlugField("identificador", max_length=60, unique=True, help_text="Se usa en URLs y tópicos MQTT.")
    name = models.CharField("nombre", max_length=120)
    category = models.CharField("categoría", max_length=80, blank=True)
    description = models.TextField("descripción", blank=True)
    hmi_type = models.CharField(
        "tipo de HMI",
        max_length=20,
        choices=HmiType.choices,
        default=HmiType.GENERIC,
        help_text="Qué pantalla usa el frontend para este proyecto.",
    )
    status = models.CharField("estado", max_length=20, choices=Status.choices, default=Status.DEVELOPMENT)
    image = models.CharField("imagen", max_length=120, blank=True, help_text="Archivo en frontend/public/projects/.")
    is_active = models.BooleanField("activo", default=True)
    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("actualizado", auto_now=True)

    objects = ProjectQuerySet.as_manager()

    class Meta:
        verbose_name = "proyecto"
        verbose_name_plural = "proyectos"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Device(models.Model):
    """Equipo de campo que publica datos: PLC, gateway o medidor."""

    class Kind(models.TextChoices):
        GATEWAY = "gateway", "Gateway"
        PLC = "plc", "PLC"
        METER = "meter", "Medidor"
        OTHER = "other", "Otro"

    class Decoder(models.TextChoices):
        UNSET = "unset", "Por definir"
        HAIL_V1 = "hail_v1", "Formato Hail v1"
        TEST_V1 = "test_v1", "Mensaje de prueba v1 (AguaPozo)"
        HAIWELL_CBOX = "haiwell_cbox", "Haiwell CBOX"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="devices", verbose_name="proyecto")
    code = models.SlugField(
        "código", max_length=60, help_text="Único dentro del proyecto; forma parte del tópico MQTT."
    )
    name = models.CharField("nombre", max_length=120)
    kind = models.CharField("tipo", max_length=20, choices=Kind.choices, default=Kind.GATEWAY)
    hardware_model = models.CharField("modelo", max_length=120, blank=True)
    decoder = models.CharField("decodificador", max_length=30, choices=Decoder.choices, default=Decoder.UNSET)
    mqtt_username = models.CharField(
        "usuario MQTT",
        max_length=120,
        unique=True,
        null=True,
        blank=True,
        validators=[RegexValidator(r"^[A-Za-z0-9._-]+$", "Solo letras, números, punto, guion y guion bajo.")],
    )
    mqtt_password_hash = models.CharField("contraseña MQTT (hash)", max_length=256, blank=True, editable=False)
    last_seen_at = models.DateTimeField("último mensaje", null=True, blank=True, editable=False)
    is_active = models.BooleanField("activo", default=True)

    class Meta:
        verbose_name = "dispositivo"
        verbose_name_plural = "dispositivos"
        ordering = ["code"]
        constraints = [models.UniqueConstraint(fields=["project", "code"], name="device_unique_code_per_project")]

    def __str__(self) -> str:
        return f"{self.code} · {self.name}"

    @property
    def telemetry_topic(self) -> str:
        return f"hail/{self.project.organization.slug}/{self.project.slug}/{self.code}/telemetry"

    def set_mqtt_password(self, raw_password: str) -> None:
        """Guarda la contraseña en el formato de Mosquitto (PBKDF2-SHA512); nunca en claro."""
        from apps.telemetry.broker_auth import mosquitto_hash

        self.mqtt_password_hash = mosquitto_hash(raw_password)


class Signal(models.Model):
    """Variable medida o comandada: un tag del PLC o del medidor."""

    class Kind(models.TextChoices):
        AI = "AI", "Entrada analógica"
        AO = "AO", "Salida analógica"
        DI = "DI", "Entrada digital"
        DO = "DO", "Salida digital"
        STATE = "STATE", "Estado de equipo"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="signals", verbose_name="proyecto")
    device = models.ForeignKey(
        Device, on_delete=models.SET_NULL, null=True, blank=True, related_name="signals", verbose_name="dispositivo"
    )
    tag = models.CharField("tag", max_length=80)
    description = models.CharField("descripción", max_length=200, blank=True)
    kind = models.CharField("tipo", max_length=10, choices=Kind.choices, default=Kind.AI)
    unit = models.CharField("unidad", max_length=20, blank=True)
    min_value = models.FloatField("mínimo válido", null=True, blank=True)
    max_value = models.FloatField("máximo válido", null=True, blank=True)
    scale_factor = models.FloatField("factor de escala", default=1.0)
    offset = models.FloatField("desplazamiento", default=0.0)
    decimals = models.PositiveSmallIntegerField("decimales", default=2)
    address = models.CharField("dirección", max_length=40, blank=True, help_text="Ej. I0.0, IW64.")
    module = models.CharField("módulo", max_length=80, blank=True)
    field_device = models.CharField("elemento de campo", max_length=120, blank=True)
    logic = models.CharField("lógica", max_length=80, blank=True)
    state_labels = models.JSONField(
        "etiquetas de estado",
        default=dict,
        blank=True,
        help_text='Solo señales de estado. Ej.: {"0": "Detenida", "1": "En marcha", "2": "Falla"}.',
    )
    position = models.PositiveIntegerField("orden", default=0)
    is_active = models.BooleanField("activa", default=True)

    class Meta:
        verbose_name = "señal"
        verbose_name_plural = "señales"
        ordering = ["position", "tag"]
        constraints = [models.UniqueConstraint(fields=["project", "tag"], name="signal_unique_tag_per_project")]

    def __str__(self) -> str:
        return f"{self.tag} ({self.project.slug})"
