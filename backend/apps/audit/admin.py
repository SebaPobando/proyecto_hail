from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "action", "actor", "organization", "target_repr"]
    list_filter = ["action", "organization"]
    search_fields = ["action", "target_repr", "actor__email"]
    date_hierarchy = "created_at"
    list_select_related = ["actor", "organization"]

    # Solo lectura: la auditoría no se edita ni se borra desde el admin.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
