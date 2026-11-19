"""Consultas de lectura de telemetría para la API."""

import math
from collections import defaultdict
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from apps.projects.models import Project, Signal

from .models import LatestReading, Reading


def latest_snapshot(project: Project, *, now: datetime | None = None) -> dict:
    """Valor actual de cada señal activa del proyecto.

    Las señales sin datos se incluyen con valor nulo. Una lectura más antigua
    que TELEMETRY_STALE_SECONDS se marca `stale`: la pantalla no debe
    presentarla como actual.
    """
    now = now or timezone.now()
    stale_after = settings.TELEMETRY_STALE_SECONDS
    latest = {r.signal_id: r for r in LatestReading.objects.filter(signal__project=project, signal__is_active=True)}
    readings = []
    for signal in Signal.objects.filter(project=project, is_active=True):
        reading = latest.get(signal.pk)
        value = reading.value if reading else None
        readings.append(
            {
                "tag": signal.tag,
                "description": signal.description,
                "kind": signal.kind,
                "unit": signal.unit,
                "decimals": signal.decimals,
                "value": value,
                "state_label": _state_label(signal, value),
                "quality": reading.quality if reading else None,
                "time": reading.time if reading else None,
                "stale": reading is None or (now - reading.time).total_seconds() > stale_after,
            }
        )
    return {"server_time": now, "stale_after_seconds": stale_after, "readings": readings}


def _state_label(signal: Signal, value: float | None) -> str | None:
    if value is None or not signal.state_labels:
        return None
    return signal.state_labels.get(str(int(value)))


def history(signals: list[Signal], start: datetime, end: datetime, points: int) -> dict:
    """Serie agregada por intervalos iguales entre `start` y `end`.

    Divide el rango en `points` intervalos y entrega promedio, mínimo, máximo y
    cantidad de muestras de cada uno. Los intervalos sin datos se omiten: un
    hueco en el gráfico es un hueco real, no un cero.

    En F2 la agregación se hace en Python; con volúmenes reales se reemplaza por
    agregados continuos de TimescaleDB sin cambiar este contrato.
    """
    bucket_seconds = max(1, math.ceil((end - start).total_seconds() / points))
    bucket = timedelta(seconds=bucket_seconds)
    acc: dict[int, dict[int, list[float]]] = defaultdict(dict)
    rows = (
        Reading.objects.filter(signal__in=signals, time__gte=start, time__lt=end)
        .order_by("signal_id", "time")
        .values_list("signal_id", "time", "value")
    )
    for signal_id, time, value in rows.iterator(chunk_size=5000):
        index = int((time - start) / bucket)
        stats = acc[signal_id].setdefault(index, [0.0, math.inf, -math.inf, 0])
        stats[0] += value
        stats[1] = min(stats[1], value)
        stats[2] = max(stats[2], value)
        stats[3] += 1
    series = []
    for signal in signals:
        buckets = acc.get(signal.pk, {})
        series.append(
            {
                "tag": signal.tag,
                "unit": signal.unit,
                "points": [
                    {"time": start + index * bucket, "avg": s[0] / s[3], "min": s[1], "max": s[2], "count": s[3]}
                    for index, s in sorted(buckets.items())
                ],
            }
        )
    return {"start": start, "end": end, "bucket_seconds": bucket_seconds, "series": series}
