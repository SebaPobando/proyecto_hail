"""API HTTP de Hail (Django Ninja).

Autenticación por sesión de Django. Ninja exige el token CSRF en toda
petición que use la cookie de sesión y no sea de solo lectura.
El esquema OpenAPI queda en /api/openapi.json y la documentación en /api/docs.
"""

from django.db import connection
from ninja import NinjaAPI
from ninja.security import django_auth

from apps.accounts.api import router as auth_router
from apps.projects.api import router as projects_router
from apps.telemetry.api import router as telemetry_router

api = NinjaAPI(
    title="Hail API",
    version="1",
    description="Supervisión IoT multitenant de procesos de automatización.",
    auth=django_auth,
    urls_namespace="api",
)

api.add_router("/auth", auth_router, tags=["auth"])
api.add_router("/projects", projects_router, tags=["proyectos"])
api.add_router("/projects", telemetry_router, tags=["telemetría"])


@api.get("/health", auth=None, tags=["sistema"])
def health(request):
    """Estado del servicio y de la base de datos (para healthchecks)."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return {"status": "ok"}
