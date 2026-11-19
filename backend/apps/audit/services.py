from .context import get_current_actor
from .models import AuditLog


def record(action: str, *, actor=None, organization=None, target=None, **data) -> AuditLog:
    """Guarda un registro de auditoría. Si no se indica actor, usa el de la petición en curso."""
    return AuditLog.objects.create(
        action=action,
        actor=actor if actor is not None else get_current_actor(),
        organization=organization,
        target_type=target._meta.label_lower if target is not None else "",
        target_id=str(target.pk) if target is not None else "",
        target_repr=str(target)[:200] if target is not None else "",
        data=data,
    )
