"""Alarmas de los proyectos visibles para el usuario.

Las listas pasan por `Project.objects.for_user()`; una alarma de un proyecto
ajeno responde 404. Reconocer exige rol de operador o superior.
"""

from typing import Literal

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Status
from ninja.errors import HttpError

from apps.audit.services import record
from apps.projects.models import Project
from apps.projects.permissions import can_operate, visible_project
from apps.realtime.events import notify_on_commit

from .models import PRIORITY_RANK, Alarm, Priority
from .schemas import AcknowledgeIn, AlarmOut, ProjectAlarmSummary

router = Router()

HISTORY_LIMIT = 200


def alarms_for(user):
    return Alarm.objects.filter(project__in=Project.objects.for_user(user)).select_related(
        "project", "rule__signal", "rule__device", "acknowledged_by"
    )


@router.get("", response=list[AlarmOut])
def list_alarms(request, project: str | None = None, status: Literal["open", "all"] = "open"):
    """Alarmas abiertas (activas o sin reconocer) o el historial reciente, de todos o un proyecto."""
    alarms = alarms_for(request.user)
    if project:
        alarms = alarms.filter(project=visible_project(request.user, project))
    if status == "open":
        return alarms.open().order_by("-raised_at")
    return alarms.order_by("-raised_at")[:HISTORY_LIMIT]


@router.get("/summary", response=list[ProjectAlarmSummary])
def summary(request):
    """Conteo de alarmas abiertas por proyecto (solo proyectos con alguna abierta)."""
    rows = (
        alarms_for(request.user)
        .open()
        .values("project__slug")
        .annotate(
            active=Count("id", filter=Q(cleared_at__isnull=True)),
            unacknowledged=Count("id", filter=Q(acknowledged_at__isnull=True)),
            open=Count("id"),
            high=Count("id", filter=Q(rule__priority=Priority.HIGH)),
            medium=Count("id", filter=Q(rule__priority=Priority.MEDIUM)),
        )
    )
    result = []
    for row in rows:
        highest = Priority.HIGH if row["high"] else Priority.MEDIUM if row["medium"] else Priority.LOW
        result.append(
            {
                "project": row["project__slug"],
                "active": row["active"],
                "unacknowledged": row["unacknowledged"],
                "open": row["open"],
                "highest_priority": highest,
            }
        )
    return sorted(result, key=lambda r: (PRIORITY_RANK[r["highest_priority"]], r["project"]))


@router.post("/{alarm_id}/acknowledge", response={200: AlarmOut, 409: dict})
def acknowledge(request, alarm_id: int, payload: AcknowledgeIn):
    """Reconoce una alarma: alguien la vio y se hace cargo. Requiere rol de operador o superior."""
    alarm = get_object_or_404(alarms_for(request.user), pk=alarm_id)
    project = visible_project(request.user, alarm.project.slug)
    if not can_operate(request.user, project):
        raise HttpError(403, "Tu rol en este proyecto solo permite ver. Pide rol de operador para reconocer alarmas.")
    if alarm.acknowledged_at is not None:
        return Status(409, {"detail": "La alarma ya estaba reconocida."})
    alarm.acknowledged_at = timezone.now()
    alarm.acknowledged_by = request.user
    alarm.ack_comment = payload.comment.strip()
    alarm.save(update_fields=["acknowledged_at", "acknowledged_by", "ack_comment"])
    record(
        "alarm.acknowledged",
        actor=request.user,
        organization=project.organization,
        target=alarm,
        tag=alarm.rule.subject,
        comment=alarm.ack_comment,
    )
    notify_on_commit(project.slug, "alarms")
    return alarm
