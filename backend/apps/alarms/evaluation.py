"""Evaluación de reglas de alarma sobre lecturas nuevas.

Se llama desde `telemetry.services.ingest()`, dentro de la misma transacción,
solo con las lecturas que pasaron a ser la lectura actual de su señal (un
mensaje atrasado completa el historial pero no activa ni normaliza alarmas).

Las lecturas de calidad mala o dudosa no activan ni normalizan: un sensor
defectuoso no debe esconder ni inventar una condición de proceso.
"""

from django.db import IntegrityError, transaction

from apps.telemetry.models import Quality

from .models import Alarm, AlarmRule

TRUSTED = {Quality.GOOD, Quality.SIMULATED}


def condition_met(rule: AlarmRule, value: float) -> bool:
    if rule.condition == AlarmRule.Condition.HIGH:
        return value >= rule.threshold
    if rule.condition == AlarmRule.Condition.LOW:
        return value <= rule.threshold
    return round(value) == round(rule.threshold)


def back_to_normal(rule: AlarmRule, value: float) -> bool:
    """Con banda muerta: la alarma se normaliza solo al alejarse del umbral."""
    if rule.condition == AlarmRule.Condition.HIGH:
        return value < rule.threshold - rule.deadband
    if rule.condition == AlarmRule.Condition.LOW:
        return value > rule.threshold + rule.deadband
    return round(value) != round(rule.threshold)


def evaluate(readings) -> list[Alarm]:
    """Activa o normaliza alarmas según las lecturas. Devuelve las alarmas nuevas."""
    readings = [r for r in readings if r.quality in TRUSTED]
    if not readings:
        return []
    by_signal = {r.signal_id: r for r in readings}
    rules = list(AlarmRule.objects.filter(signal_id__in=by_signal, is_enabled=True).select_related("signal"))
    if not rules:
        return []
    active = {a.rule_id: a for a in Alarm.objects.filter(rule__in=rules, cleared_at__isnull=True)}
    raised = []
    for rule in rules:
        reading = by_signal[rule.signal_id]
        alarm = active.get(rule.pk)
        if alarm is not None:
            if back_to_normal(rule, reading.value):
                alarm.cleared_at = reading.time
                alarm.clear_value = reading.value
                alarm.save(update_fields=["cleared_at", "clear_value"])
        elif condition_met(rule, reading.value):
            try:
                with transaction.atomic():
                    raised.append(
                        Alarm.objects.create(
                            rule=rule,
                            project_id=rule.signal.project_id,
                            raised_at=reading.time,
                            raise_value=reading.value,
                            simulated=reading.quality == Quality.SIMULATED,
                        )
                    )
            except IntegrityError:
                # Otra ingesta concurrente ya la activó.
                pass
    return raised
