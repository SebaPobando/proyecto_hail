"""Reglas por dispositivo (sin comunicación), persistencia y proyecto en la regla."""

import django.db.models.deletion
from django.db import migrations, models


def fill_project(apps, schema_editor):
    AlarmRule = apps.get_model("alarms", "AlarmRule")
    for rule in AlarmRule.objects.select_related("signal"):
        rule.project_id = rule.signal.project_id
        rule.save(update_fields=["project"])


class Migration(migrations.Migration):
    dependencies = [
        ("alarms", "0001_initial"),
        ("projects", "0003_alter_device_mqtt_username"),
    ]

    operations = [
        migrations.AddField(
            model_name="alarmrule",
            name="project",
            field=models.ForeignKey(
                null=True,
                editable=False,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="alarm_rules",
                to="projects.project",
            ),
        ),
        migrations.RunPython(fill_project, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="alarmrule",
            name="project",
            field=models.ForeignKey(
                editable=False,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="alarm_rules",
                to="projects.project",
            ),
        ),
        migrations.AlterField(
            model_name="alarmrule",
            name="signal",
            field=models.ForeignKey(
                blank=True,
                help_text="Para alto, bajo o estado.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="alarm_rules",
                to="projects.signal",
                verbose_name="señal",
            ),
        ),
        migrations.AddField(
            model_name="alarmrule",
            name="device",
            field=models.ForeignKey(
                blank=True,
                help_text="Solo para «sin comunicación».",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="alarm_rules",
                to="projects.device",
                verbose_name="dispositivo",
            ),
        ),
        migrations.AddField(
            model_name="alarmrule",
            name="on_delay",
            field=models.PositiveIntegerField(
                default=0,
                help_text="La condición debe mantenerse este tiempo antes de activar la alarma. 0 = inmediata. "
                "Filtra picos breves. No aplica a comunicación, cuyo umbral ya es un tiempo.",
                verbose_name="persistencia (s)",
            ),
        ),
        migrations.AddField(
            model_name="alarmrule",
            name="pending_since",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AlterField(
            model_name="alarmrule",
            name="condition",
            field=models.CharField(
                choices=[
                    ("high", "Alto: valor ≥ umbral"),
                    ("low", "Bajo: valor ≤ umbral"),
                    ("state", "Estado: valor = umbral"),
                    ("comm", "Sin comunicación: sin datos del dispositivo por más de «umbral» segundos"),
                ],
                max_length=10,
                verbose_name="condición",
            ),
        ),
        migrations.AlterField(
            model_name="alarmrule",
            name="threshold",
            field=models.FloatField(
                help_text="En estados, el número del estado (ej. 2 = Falla). En comunicación, segundos sin datos.",
                verbose_name="umbral",
            ),
        ),
        migrations.AlterField(
            model_name="alarmrule",
            name="deadband",
            field=models.FloatField(
                default=0.0,
                help_text="Histéresis para normalizar: un alto se normaliza bajo umbral − banda; un bajo, sobre umbral "
                "+ banda. Evita que la alarma parpadee cerca del umbral. Solo alto y bajo.",
                verbose_name="banda muerta",
            ),
        ),
        migrations.AlterModelOptions(
            name="alarmrule",
            options={
                "ordering": ["project__name", "pk"],
                "verbose_name": "regla de alarma",
                "verbose_name_plural": "reglas de alarma",
            },
        ),
        migrations.AddConstraint(
            model_name="alarmrule",
            constraint=models.CheckConstraint(
                condition=models.Q(("device__isnull", True), ("signal__isnull", False))
                | models.Q(("device__isnull", False), ("signal__isnull", True)),
                name="alarmrule_signal_xor_device",
            ),
        ),
        migrations.AlterField(
            model_name="alarm",
            name="raise_value",
            field=models.FloatField(
                blank=True,
                help_text="En comunicación: segundos sin datos (vacío si nunca envió).",
                null=True,
                verbose_name="valor al activarse",
            ),
        ),
    ]
