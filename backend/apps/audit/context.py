"""Usuario que origina la petición en curso, para atribuir registros de auditoría.

Se guarda la petición y no `request.user`: ese usuario es un objeto perezoso
que consulta la base al tocarlo, y asgiref inspecciona las variables de
contexto al pasar a código asíncrono (por ejemplo, al enviar un aviso en vivo).
"""

from contextvars import ContextVar

current_request: ContextVar = ContextVar("hail_current_request", default=None)


def get_current_actor():
    request = current_request.get()
    user = getattr(request, "user", None)
    return user if user is not None and getattr(user, "is_authenticated", False) else None
