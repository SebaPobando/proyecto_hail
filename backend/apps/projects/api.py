"""Proyectos visibles para el usuario autenticado.

Todo pasa por `Project.objects.for_user()`. Un proyecto que el usuario no
puede ver responde 404, igual que uno inexistente, para no revelar que existe.
"""

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from ninja import Router

from .models import Project, Signal
from .schemas import ProjectDetailOut, ProjectOut, SignalOut

router = Router()


def visible_projects(request):
    user = request.user
    return Project.objects.for_user(user).with_user_role(user).select_related("organization")


@router.get("", response=list[ProjectOut])
def list_projects(request):
    """Proyectos a los que el usuario tiene acceso."""
    return visible_projects(request).order_by("name")


@router.get("/{slug}", response=ProjectDetailOut)
def get_project(request, slug: str):
    projects = visible_projects(request).annotate(signal_count=Count("signals", filter=Q(signals__is_active=True)))
    return get_object_or_404(projects, slug=slug)


@router.get("/{slug}/signals", response=list[SignalOut])
def list_signals(request, slug: str):
    project = get_object_or_404(visible_projects(request), slug=slug)
    return Signal.objects.filter(project=project, is_active=True).select_related("device")
