"""Ingesta de mensajes de campo.

`ingest()` es independiente de MQTT: el worker (`manage.py ingest_mqtt`), el
simulador y las pruebas la llaman igual. Reglas:

- El tópico identifica al dispositivo: hail/{organización}/{proyecto}/{dispositivo}/telemetry.
  Si la organización, el proyecto o el dispositivo no calzan o están inactivos, el mensaje se rechaza.
- La fecha de adquisición debe estar entre 7 días atrás y 5 segundos adelante.
- Cada valor se valida contra su señal: debe pertenecer al dispositivo y estar en su rango físico.
  Un valor inválido se descarta sin perder los demás del mismo mensaje.
- Los duplicados (misma señal y mismo instante) se ignoran.
- La lectura actual nunca retrocede: un mensaje atrasado solo completa el historial.
- Las lecturas que pasan a ser actuales se evalúan contra las reglas de alarma.
"""

import logging
from dataclasses import dataclass, field
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.alarms.evaluation import evaluate as evaluate_alarms
from apps.projects.models import Device

from .decoders import DECODERS, DecodeError
from .models import LatestReading, Reading

logger = logging.getLogger(__name__)

MAX_PAYLOAD_BYTES = 64 * 1024
MAX_AGE = timedelta(days=7)
MAX_CLOCK_SKEW = timedelta(seconds=5)


class IngestError(ValueError):
    """El mensaje completo se rechaza."""


@dataclass
class IngestResult:
    device: Device
    accepted: int = 0
    rejected: dict[str, str] = field(default_factory=dict)  # tag -> motivo
    alarms_raised: int = 0


def parse_topic(topic: str) -> tuple[str, str, str]:
    parts = topic.split("/")
    if len(parts) != 5 or parts[0] != "hail" or parts[4] != "telemetry" or not all(parts[1:4]):
        raise IngestError(f"Tópico inválido: {topic}")
    return parts[1], parts[2], parts[3]


def find_device(topic: str) -> Device:
    org, project, code = parse_topic(topic)
    try:
        return Device.objects.select_related("project").get(
            code=code,
            is_active=True,
            project__slug=project,
            project__is_active=True,
            project__organization__slug=org,
            project__organization__is_active=True,
        )
    except Device.DoesNotExist as error:
        raise IngestError(f"Dispositivo desconocido o inactivo para el tópico {topic}") from error


def ingest(topic: str, payload: bytes, *, now=None) -> IngestResult:
    now = now or timezone.now()
    if len(payload) > MAX_PAYLOAD_BYTES:
        raise IngestError("Mensaje demasiado grande")
    device = find_device(topic)
    decoder = DECODERS.get(device.decoder)
    if decoder is None:
        raise IngestError(f"El dispositivo {device.code} no tiene decodificador configurado")
    try:
        sample = decoder(payload)
    except DecodeError as error:
        raise IngestError(str(error)) from error
    if not (now - MAX_AGE <= sample.time <= now + MAX_CLOCK_SKEW):
        raise IngestError("Fecha de adquisición fuera de la ventana permitida")

    signals = {s.tag: s for s in device.signals.filter(is_active=True)}
    result = IngestResult(device=device)
    readings = []
    for tag, (raw, quality) in sample.values.items():
        signal = signals.get(tag)
        if signal is None:
            result.rejected[tag] = "tag desconocido para este dispositivo"
            continue
        value = raw * signal.scale_factor + signal.offset
        if (signal.min_value is not None and value < signal.min_value) or (
            signal.max_value is not None and value > signal.max_value
        ):
            result.rejected[tag] = "fuera del rango físico de la señal"
            continue
        readings.append(Reading(signal=signal, time=sample.time, value=value, quality=quality))

    with transaction.atomic():
        Reading.objects.bulk_create(readings, ignore_conflicts=True)
        current = []
        for reading in readings:
            fields = {"time": reading.time, "value": reading.value, "quality": reading.quality, "received_at": now}
            advanced = LatestReading.objects.filter(signal=reading.signal, time__lt=reading.time).update(**fields)
            if not advanced:
                _, created = LatestReading.objects.get_or_create(signal=reading.signal, defaults=fields)
                advanced = created
            if advanced:
                current.append(reading)
        Device.objects.filter(pk=device.pk).update(last_seen_at=now)
        result.alarms_raised = len(evaluate_alarms(current))

    result.accepted = len(readings)
    if result.rejected:
        logger.warning("Valores descartados de %s: %s", topic, result.rejected)
    return result
