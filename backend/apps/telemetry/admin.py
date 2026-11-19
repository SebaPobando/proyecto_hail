from django.contrib import admin

from .models import LatestReading


@admin.register(LatestReading)
class LatestReadingAdmin(admin.ModelAdmin):
    """Vista de solo lectura para ver los datos entrar. El historial se consulta por la API."""

    list_display = ["signal", "project", "value", "unit", "quality", "time", "received_at"]
    list_filter = ["signal__project", "quality"]
    search_fields = ["signal__tag", "signal__description"]
    list_select_related = ["signal__project"]
    ordering = ["signal__project__name", "signal__position"]

    @admin.display(description="proyecto", ordering="signal__project__name")
    def project(self, obj):
        return obj.signal.project

    @admin.display(description="unidad")
    def unit(self, obj):
        return obj.signal.unit

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
