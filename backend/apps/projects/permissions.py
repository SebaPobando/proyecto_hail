"""Permisos por rol dentro de un proyecto.

- Lector: ve el proyecto, sus datos y su bitácora.
- Operador y administrador del cliente: además reconocen alarmas y escriben en la bitácora.
- Administrador de plataforma (`is_platform_admin`): todo, en todos los proyectos.
"""

from django.shortcuts import get_object_or_404

from apps.tenancy.models import Membership

from .models import Project

OPERATING_ROLES = {Membership.Role.OPERATOR, Membership.Role.ORG_ADMIN}


def can_operate(user, project: Project) -> bool:
    """`project` debe venir anotado con `with_user_role(user)`."""
    if user.is_platform_admin:
        return True
    return getattr(project, "user_role", None) in OPERATING_ROLES


def visible_project(user, slug: str) -> Project:
    """Proyecto visible para el usuario, con su rol anotado; 404 si no existe o no lo puede ver."""
    return get_object_or_404(
        Project.objects.for_user(user).with_user_role(user).select_related("organization"), slug=slug
    )
