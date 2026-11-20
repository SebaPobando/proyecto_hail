"""Carga los tres proyectos actuales de Hail como datos.

Idempotente: puede ejecutarse varias veces; actualiza en vez de duplicar.
Con --demo-users (solo con DEBUG=True) crea un usuario por cliente: el de
AguaPozo es operador (puede reconocer alarmas) y los demás son lectores.

    python manage.py seed_demo
    python manage.py seed_demo --demo-users
"""

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.alarms.models import AlarmRule, Priority
from apps.projects.models import Device, Project, Signal
from apps.tenancy.models import Membership, Organization

SEED_DATA = Path(__file__).resolve().parents[2] / "seed_data"
DEMO_PASSWORD = "hail-demo-2026"

ORGANIZATIONS = [
    ("aguapozo", "AguaPozo"),
    ("ulagos", "Universidad de Los Lagos"),
    ("nutrial", "Nutrial"),
]

PROJECTS = [
    {
        "slug": "aguapozo",
        "organization": "aguapozo",
        "name": "AguaPozo",
        "category": "Agua potable",
        "description": "Captación, tratamiento y almacenamiento. Consulta niveles, caudal y cloro residual.",
        "hmi_type": Project.HmiType.AGUAPOZO,
        "status": Project.Status.DEMO,
        "image": "aguapozo.jpg",
    },
    {
        "slug": "medidores-electricos",
        "organization": "ulagos",
        "name": "Medidores Eléctricos",
        "category": "Energía",
        "description": "Supervisión de cinco medidores, consumo, potencia y calidad eléctrica por equipo.",
        "hmi_type": Project.HmiType.ELECTRICAL,
        "status": Project.Status.DEMO,
        "image": "medidores.svg",
    },
    {
        "slug": "nutrial",
        "organization": "nutrial",
        "name": "Nutrial",
        "category": "Proceso industrial",
        "description": "Línea de sustitutos lácteos en polvo. Tamizado, transporte neumático, mezclado y ensacado.",
        "hmi_type": Project.HmiType.NUTRIAL,
        "status": Project.Status.DEVELOPMENT,
        "image": "nutrial.svg",
    },
]

STATE_LABELS = {
    "P-101": {"0": "Detenida", "1": "En marcha", "2": "Falla"},
    "D-101": {"0": "Inactiva", "1": "Activa", "2": "Falla"},
}

AGUAPOZO_SIGNALS = [
    # tag, descripción, tipo, unidad, mín, máx, decimales
    ("LT-101", "Nivel del estanque", "AI", "%", 0, 100, 1),
    ("LT-102", "Nivel del pozo: profundidad desde la boca al espejo de agua", "AI", "m", 0, 50, 1),
    ("FT-101", "Caudal de impulsión", "AI", "m³/h", 0, None, 1),
    ("AIT-101", "Cloro residual", "AI", "mg/L", 0, None, 2),
    ("P-101", "Bomba sumergible (marcha / detenida / falla)", "STATE", "", None, None, 0),
    ("D-101", "Dosificación de cloro (activa / inactiva / falla)", "STATE", "", None, None, 0),
]

METERS = [
    ("MED-01", "Edificio Docente", "Accuenergy Acuvim II-R"),
    ("MED-02", "Medidor 2", "Schneider PM5330"),
    ("MED-03", "Medidor 3", "CHINT PD7777"),
    ("MED-04", "Medidor 4", "CHINT PD666"),
    ("MED-05", "Medidor 5", "CHINT PD666"),
]

METER_VARIABLES = [
    # sufijo, descripción, unidad, decimales
    ("VAN", "Voltaje A–N", "V", 1),
    ("VAB", "Voltaje A–B", "V", 1),
    ("IA", "Corriente fase A", "A", 2),
    ("P", "Potencia activa total", "kW", 2),
    ("FP", "Factor de potencia", "", 2),
    ("F", "Frecuencia", "Hz", 2),
    ("THDV", "THD de voltaje máximo", "%", 2),
    ("E", "Energía activa acumulada", "kWh", 1),
]


# Reglas de alarma de demostración: (tag, condición, umbral, banda muerta, prioridad, mensaje).
# Cloro: NCh409/1 exige entre 0,2 y 2,0 mg/L de cloro libre residual. THD: IEEE 519, baja tensión.
AGUAPOZO_RULES = [
    ("LT-101", "low", 20, 2, Priority.HIGH, "Nivel bajo del estanque: revisar la bomba P-101 y el consumo."),
    (
        "LT-101",
        "high",
        95,
        2,
        Priority.MEDIUM,
        "Nivel alto del estanque: riesgo de rebalse, revisar el control de nivel.",
    ),
    (
        "AIT-101",
        "low",
        0.2,
        0.05,
        Priority.HIGH,
        "Cloro residual bajo 0,2 mg/L (NCh409): revisar la dosificación D-101.",
    ),
    (
        "AIT-101",
        "high",
        2.0,
        0.1,
        Priority.MEDIUM,
        "Cloro residual sobre 2,0 mg/L (NCh409): revisar el ajuste de la dosificadora.",
    ),
    ("P-101", "state", 2, 0, Priority.HIGH, "Falla de la bomba sumergible: verificar protecciones en el tablero."),
    ("D-101", "state", 2, 0, Priority.MEDIUM, "Falla en la dosificación de cloro: el agua sale sin desinfección."),
]
METER_RULES = [
    ("F", "low", 49.5, 0.05, Priority.MEDIUM, "Frecuencia bajo 49,5 Hz."),
    ("F", "high", 50.5, 0.05, Priority.MEDIUM, "Frecuencia sobre 50,5 Hz."),
    ("THDV", "high", 8, 0.5, Priority.LOW, "THD de voltaje sobre 8 % (IEEE 519, baja tensión)."),
]
DEMO_OPERATORS = {"aguapozo"}


class Command(BaseCommand):
    help = "Carga AguaPozo, Medidores Eléctricos y Nutrial como organizaciones, proyectos, dispositivos y señales."

    def add_arguments(self, parser):
        parser.add_argument(
            "--demo-users", action="store_true", help="Crea un usuario lector por cliente (solo DEBUG)."
        )

    @transaction.atomic
    def handle(self, *args, **options):
        orgs = {
            slug: Organization.objects.update_or_create(slug=slug, defaults={"name": name})[0]
            for slug, name in ORGANIZATIONS
        }
        projects = {}
        for spec in PROJECTS:
            data = {**spec, "organization": orgs[spec["organization"]]}
            slug = data.pop("slug")
            projects[slug] = Project.objects.update_or_create(slug=slug, defaults=data)[0]

        self._seed_aguapozo(projects["aguapozo"])
        self._seed_meters(projects["medidores-electricos"])
        self._seed_nutrial(projects["nutrial"])
        rules = self._seed_alarm_rules(projects)

        if options["demo_users"]:
            if not settings.DEBUG:
                raise CommandError("--demo-users solo está permitido con DEBUG=True.")
            for slug, org in orgs.items():
                user, created = User.objects.get_or_create(email=f"cliente-{slug}@hail.local")
                if created:
                    user.set_password(DEMO_PASSWORD)
                    user.save()
                role = Membership.Role.OPERATOR if slug in DEMO_OPERATORS else Membership.Role.VIEWER
                Membership.objects.update_or_create(user=user, organization=org, defaults={"role": role})
            self.stdout.write(
                f"Usuarios demo: cliente-<org>@hail.local / {DEMO_PASSWORD} (cliente-aguapozo es operador)"
            )

        total = Signal.objects.filter(project__in=projects.values()).count()
        summary = f"Listo: {len(orgs)} clientes, {len(projects)} proyectos, {total} señales, {rules} reglas de alarma."
        self.stdout.write(self.style.SUCCESS(summary))

    def _seed_aguapozo(self, project):
        device, _ = Device.objects.update_or_create(
            project=project,
            code="cbox-01",
            defaults={
                "name": "Gateway Haiwell CBOX",
                "kind": Device.Kind.GATEWAY,
                "hardware_model": "Haiwell CBOX · PLC Siemens S7-1200",
                "decoder": Device.Decoder.TEST_V1,
            },
        )
        for position, (tag, description, kind, unit, low, high, decimals) in enumerate(AGUAPOZO_SIGNALS, start=1):
            Signal.objects.update_or_create(
                project=project,
                tag=tag,
                defaults={
                    "device": device,
                    "description": description,
                    "kind": kind,
                    "unit": unit,
                    "min_value": low,
                    "max_value": high,
                    "decimals": decimals,
                    "position": position,
                    "state_labels": STATE_LABELS.get(tag, {}),
                },
            )

    def _seed_meters(self, project):
        position = 0
        for code, name, model in METERS:
            device, _ = Device.objects.update_or_create(
                project=project,
                code=code.lower(),
                defaults={
                    "name": name,
                    "kind": Device.Kind.METER,
                    "hardware_model": model,
                    "decoder": Device.Decoder.HAIL_V1,
                },
            )
            for suffix, description, unit, decimals in METER_VARIABLES:
                position += 1
                Signal.objects.update_or_create(
                    project=project,
                    tag=f"{code}-{suffix}",
                    defaults={
                        "device": device,
                        "description": f"{name} · {description}",
                        "kind": Signal.Kind.AI,
                        "unit": unit,
                        "decimals": decimals,
                        "position": position,
                    },
                )

    def _seed_nutrial(self, project):
        device, _ = Device.objects.update_or_create(
            project=project,
            code="plc-01",
            defaults={"name": "PLC del tablero", "kind": Device.Kind.PLC, "hardware_model": "Siemens CPU 1215C"},
        )
        rows = json.loads((SEED_DATA / "nutrial_signals.json").read_text(encoding="utf-8"))
        for row in rows:
            Signal.objects.update_or_create(
                project=project,
                tag=row["tag"],
                defaults={
                    "device": device,
                    "description": row["description"],
                    "kind": row["type"],
                    "address": row.get("address") or "",
                    "module": row.get("module") or "",
                    "field_device": row.get("device") or "",
                    "logic": row.get("logic") or "",
                    "position": row["number"],
                    "decimals": 2 if row["type"] in ("AI", "AO") else 0,
                },
            )

    def _seed_alarm_rules(self, projects) -> int:
        specs = [(projects["aguapozo"], *rule) for rule in AGUAPOZO_RULES]
        for code, _, _ in METERS:
            specs += [(projects["medidores-electricos"], f"{code}-{suffix}", *rest) for suffix, *rest in METER_RULES]
        for project, tag, condition, threshold, deadband, priority, message in specs:
            signal = Signal.objects.get(project=project, tag=tag)
            AlarmRule.objects.update_or_create(
                signal=signal,
                condition=condition,
                defaults={"threshold": threshold, "deadband": deadband, "priority": priority, "message": message},
            )
        return len(specs)
