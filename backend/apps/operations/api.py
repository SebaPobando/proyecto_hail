"""Bitácora compartida de los proyectos visibles para el usuario.

Todos los que ven un proyecto ven su bitácora. Crear, cambiar y anotar exige
rol de operador o superior. Un seguimiento de un proyecto ajeno responde 404.
"""

from typing import Literal

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Status
from ninja.errors import HttpError

from apps.alarms.models import Alarm
from apps.projects.models import Project
from apps.projects.permissions import can_operate, visible_project
from apps.realtime.events import notify_on_commit

from .models import WorkItem, WorkItemEvent
from .schemas import NoteIn, WorkItemIn, WorkItemOut, WorkItemPatch

router = Router()

LIST_LIMIT = 300
FORBIDDEN = "Tu rol en este proyecto solo permite ver. Pide rol de operador para escribir en la bitácora."


def items_for(user):
    return (
        WorkItem.objects.filter(project__in=Project.objects.for_user(user))
        .select_related("project", "created_by")
        .prefetch_related("events__author")
    )


def require_operator(user, slug: str):
    project = visible_project(user, slug)
    if not can_operate(user, project):
        raise HttpError(403, FORBIDDEN)
    return project


@router.get("", response=list[WorkItemOut])
def list_items(request, project: str | None = None, status: Literal["open", "all"] = "all"):
    items = items_for(request.user)
    if project:
        items = items.filter(project=visible_project(request.user, project))
    if status == "open":
        items = items.exclude(status=WorkItem.Status.RESOLVED)
    return items[:LIST_LIMIT]


@router.post("", response={201: WorkItemOut})
def create_item(request, payload: WorkItemIn):
    project = require_operator(request.user, payload.project)
    alarm = None
    if payload.alarm_id is not None:
        alarm = get_object_or_404(Alarm, pk=payload.alarm_id, project=project)
    title = payload.title.strip()
    if not title:
        raise HttpError(422, "El asunto no puede quedar vacío.")
    with transaction.atomic():
        item = WorkItem.objects.create(
            project=project,
            asset=payload.asset.strip(),
            title=title,
            priority=payload.priority,
            owner=payload.owner.strip(),
            due_date=payload.due_date,
            alarm=alarm,
            created_by=request.user,
        )
        text = f"Creado desde la alarma de {alarm.rule.subject}" if alarm else "Seguimiento creado"
        WorkItemEvent.objects.create(item=item, kind=WorkItemEvent.Kind.CREATED, text=text, author=request.user)
        notify_on_commit(project.slug, "work_items")
    return Status(201, items_for(request.user).get(pk=item.pk))


@router.patch("/{item_id}", response=WorkItemOut)
def update_item(request, item_id: int, payload: WorkItemPatch):
    item = get_object_or_404(items_for(request.user), pk=item_id)
    require_operator(request.user, item.project.slug)
    changes = []
    data = payload.dict(exclude_unset=True)
    if data.get("status") and data["status"] != item.status:
        item.status = data["status"]
        changes.append(f"Estado cambiado a {item.get_status_display()}")
    if data.get("priority") and data["priority"] != item.priority:
        item.priority = data["priority"]
        changes.append(f"Prioridad cambiada a {item.get_priority_display()}")
    if "owner" in data and data["owner"] is not None and data["owner"].strip() != item.owner:
        item.owner = data["owner"].strip()
        changes.append(f"Responsable: {item.owner or 'sin asignar'}")
    if "due_date" in data and data["due_date"] != item.due_date:
        item.due_date = data["due_date"]
        changes.append(f"Fecha objetivo: {item.due_date:%d-%m-%Y}" if item.due_date else "Fecha objetivo eliminada")
    if changes:
        with transaction.atomic():
            item.save()
            WorkItemEvent.objects.bulk_create(
                [
                    WorkItemEvent(item=item, kind=WorkItemEvent.Kind.CHANGE, text=text, author=request.user)
                    for text in changes
                ]
            )
            notify_on_commit(item.project.slug, "work_items")
    return items_for(request.user).get(pk=item.pk)


@router.post("/{item_id}/notes", response={201: WorkItemOut})
def add_note(request, item_id: int, payload: NoteIn):
    item = get_object_or_404(items_for(request.user), pk=item_id)
    require_operator(request.user, item.project.slug)
    text = payload.text.strip()
    if not text:
        raise HttpError(422, "La nota no puede quedar vacía.")
    with transaction.atomic():
        WorkItemEvent.objects.create(item=item, kind=WorkItemEvent.Kind.NOTE, text=text, author=request.user)
        WorkItem.objects.filter(pk=item.pk).update(updated_at=timezone.now())
        notify_on_commit(item.project.slug, "work_items")
    return Status(201, items_for(request.user).get(pk=item.pk))
