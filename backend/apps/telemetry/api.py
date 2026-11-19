"""Telemetría por proyecto: lectura actual e historial.

Mismo aislamiento que el catálogo: el proyecto se resuelve con
`visible_projects()`, así un proyecto ajeno responde 404.
"""

from datetime import datetime, timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Query, Router, Status

from apps.projects.api import visible_projects
from apps.projects.models import Signal

from . import queries
from .schemas import ErrorOut, HistoryOut, LatestSnapshotOut

router = Router()

MAX_RANGE = timedelta(days=31)
MAX_TAGS = 20


@router.get("/{slug}/latest", response=LatestSnapshotOut)
def latest(request, slug: str):
    """Valor actual de cada señal, con su calidad y si está vencido."""
    project = get_object_or_404(visible_projects(request), slug=slug)
    return queries.latest_snapshot(project)


@router.get("/{slug}/history", response={200: HistoryOut, 400: ErrorOut})
def history(
    request,
    slug: str,
    tags: list[str] = Query(...),  # noqa: B008
    start: datetime = Query(...),  # noqa: B008
    end: datetime | None = None,
    points: int = Query(240, ge=2, le=2000),  # noqa: B008
):
    """Historial agregado por intervalos de las señales pedidas.

    El rango máximo es de 31 días; uno mayor se rechaza en vez de recortarse en silencio.
    """
    project = get_object_or_404(visible_projects(request), slug=slug)
    end = end or timezone.now()
    if start.tzinfo is None or end.tzinfo is None:
        return Status(400, {"detail": "Las fechas deben incluir zona horaria (ISO 8601)."})
    if end <= start:
        return Status(400, {"detail": "La fecha final debe ser posterior a la inicial."})
    if end - start > MAX_RANGE:
        return Status(400, {"detail": "El rango máximo es de 31 días."})
    wanted = list(dict.fromkeys(tags))
    if len(wanted) > MAX_TAGS:
        return Status(400, {"detail": f"Máximo {MAX_TAGS} señales por consulta."})
    signals = {s.tag: s for s in Signal.objects.filter(project=project, is_active=True, tag__in=wanted)}
    unknown = [tag for tag in wanted if tag not in signals]
    if unknown:
        return Status(400, {"detail": f"Señales desconocidas en este proyecto: {', '.join(unknown)}."})
    return Status(200, queries.history([signals[t] for t in wanted], start, end, points))
