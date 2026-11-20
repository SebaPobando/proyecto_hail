from django.contrib import admin

from .models import Alarm, AlarmRule


@admin.register(AlarmRule)
class AlarmRuleAdmin(admin.ModelAdmin):
    list_display = ["signal", "condition_display", "priority", "deadband", "message", "is_enabled", "project"]
    list_filter = ["signal__project__organization", "signal__project", "priority", "condition", "is_enabled"]
    search_fields = ["signal__tag", "signal__description", "message"]
    autocomplete_fields = ["signal"]
    list_select_related = ["signal__project"]
    list_editable = ["is_enabled"]
    fieldsets = [
        (None, {"fields": ["signal", "condition", "threshold", "deadband"]}),
        ("Para el operador", {"fields": ["priority", "message", "is_enabled"]}),
    ]

    @admin.display(description="condición")
    def condition_display(self, obj):
        return obj.describe()

    @admin.display(description="proyecto", ordering="signal__project__name")
    def project(self, obj):
        return obj.signal.project


@admin.register(Alarm)
class AlarmAdmin(admin.ModelAdmin):
    """Registro histórico: se consulta, no se edita. Reconocer se hace desde las pantallas."""

    list_display = [
        "rule",
        "project",
        "priority",
        "state_display",
        "raised_at",
        "cleared_at",
        "acknowledged_by",
        "simulated",
    ]
    list_filter = ["project__organization", "project", "rule__priority", "simulated"]
    search_fields = ["rule__signal__tag", "rule__signal__description", "ack_comment"]
    date_hierarchy = "raised_at"
    list_select_related = ["project", "rule__signal", "acknowledged_by"]

    @admin.display(description="prioridad", ordering="rule__priority")
    def priority(self, obj):
        return obj.rule.get_priority_display()

    @admin.display(description="estado")
    def state_display(self, obj):
        return Alarm.State(obj.state).label

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
