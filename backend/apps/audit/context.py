"""Usuario que origina la petición en curso, para atribuir registros de auditoría."""

from contextvars import ContextVar

current_actor: ContextVar = ContextVar("hail_current_actor", default=None)


def get_current_actor():
    user = current_actor.get()
    return user if user is not None and getattr(user, "is_authenticated", False) else None
