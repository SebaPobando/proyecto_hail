"""Evaluación de reglas de alarma.

Reglas de señal (alto, bajo, estado): `evaluate()` se llama desde
`telemetry.services.ingest()`, en la misma transacción, solo con las lecturas
que pasaron a ser la lectura actual de su señal. Un mensaje atrasado completa
el historial pero no activa ni normaliza alarmas. Las lecturas de calidad mala
o dudosa tampoco: un sensor defectuoso no debe esconder ni inventar una
condición de proceso.

Persistencia (on-delay): si la regla la tiene, la condición debe cumplirse
durante ese tiempo, medido con la hora de adquisición de las lecturas, antes
de activar la alarma.

Reglas de comunicación: `check_communication()` revisa cuánto lleva cada
dispositivo sin enviar datos. Lo llaman el worker de ingesta (con su pulso), el
simulador en modo directo y `manage.py check_alarms`. Al llegar datos de un
dispositivo, `clear_communication()` normaliza su alarma en el acto.
"""

from dataclasses import dataclass, field
from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.telemetry.models import Quality

from .models import Alarm, AlarmRule

TRUSTED = {Quality.GOOD, Quality.SIMULATED}


@dataclass
class Evaluation:
    raised: list[Alarm] = field(default_factory=list)
    cleared: int = 0
    # Proyectos con alarmas nuevas o normalizadas, para avisar a las pantallas.
    projects: set[int] = field(default_factory=set)

    @property
    def changed(self) -> bool:
        return bool(self.raised or self.cleared)


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


def _raise(rule: AlarmRule, at: datetime, value: float | None, simulated: bool, result: Evaluation) -> None:
    try:
        with transaction.atomic():
            alarm = Alarm.objects.create(
                rule=rule, project_id=rule.project_id, raised_at=at, raise_value=value, simulated=simulated
            )
    except IntegrityError:  # otra evaluación concurrente ya la activó
        return
    result.raised.append(alarm)
    result.projects.add(rule.project_id)


def _set_pending(rule: AlarmRule, since: datetime | None) -> None:
    if rule.pending_since != since:
        rule.pending_since = since
        AlarmRule.objects.filter(pk=rule.pk).update(pending_since=since)


def evaluate(readings) -> Evaluation:
    """Activa o normaliza alarmas de señal según las lecturas nuevas."""
    result = Evaluation()
    readings = [r for r in readings if r.quality in TRUSTED]
    if not readings:
        return result
    by_signal = {r.signal_id: r for r in readings}
    rules = list(AlarmRule.objects.filter(signal_id__in=by_signal, is_enabled=True).select_related("signal"))
    if not rules:
        return result
    active = {a.rule_id: a for a in Alarm.objects.filter(rule__in=rules, cleared_at__isnull=True)}
    for rule in rules:
        reading = by_signal[rule.signal_id]
        alarm = active.get(rule.pk)
        if alarm is not None:
            if back_to_normal(rule, reading.value):
                alarm.cleared_at = reading.time
                alarm.clear_value = reading.value
                alarm.save(update_fields=["cleared_at", "clear_value"])
                result.cleared += 1
                result.projects.add(rule.project_id)
            continue
        if not condition_met(rule, reading.value):
            _set_pending(rule, None)
            continue
        if rule.on_delay:
            since = rule.pending_since or reading.time
            if (reading.time - since).total_seconds() < rule.on_delay:
                _set_pending(rule, since)
                continue
        _set_pending(rule, None)
        _raise(rule, reading.time, reading.value, reading.quality == Quality.SIMULATED, result)
    return result


def clear_communication(device, now: datetime) -> Evaluation:
    """Llegaron datos del dispositivo: se normaliza su alarma de comunicación activa."""
    result = Evaluation()
    alarms = Alarm.objects.filter(
        rule__device=device, rule__condition=AlarmRule.Condition.COMM, cleared_at__isnull=True
    )
    result.cleared = alarms.update(cleared_at=now)
    if result.cleared:
        result.projects.add(device.project_id)
    return result


def check_communication(now: datetime | None = None) -> Evaluation:
    """Activa alarmas de los dispositivos que superaron su umbral sin enviar datos, o normaliza las que ya no."""
    now = now or timezone.now()
    result = Evaluation()
    rules = list(
        AlarmRule.objects.filter(
            condition=AlarmRule.Condition.COMM,
            is_enabled=True,
            device__is_active=True,
            device__project__is_active=True,
        ).select_related("device")
    )
    active = {a.rule_id: a for a in Alarm.objects.filter(rule__in=rules, cleared_at__isnull=True)}
    for rule in rules:
        last = rule.device.last_seen_at
        silent_for = None if last is None else (now - last).total_seconds()
        silent = silent_for is None or silent_for > rule.threshold
        alarm = active.get(rule.pk)
        if alarm is not None and not silent:
            alarm.cleared_at = last
            alarm.save(update_fields=["cleared_at"])
            result.cleared += 1
            result.projects.add(rule.project_id)
        elif alarm is None and silent:
            _raise(rule, now, silent_for, False, result)
    return result
