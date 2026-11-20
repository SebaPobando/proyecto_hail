from django.contrib import admin

from .models import WorkItem, WorkItemEvent


class WorkItemEventInline(admin.TabularInline):
    model = WorkItemEvent
    extra = 0
    fields = ["created_at", "kind", "text", "author"]
    readonly_fields = ["created_at", "kind", "text", "author"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(WorkItem)
class WorkItemAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "asset", "priority", "status", "owner", "due_date", "created_by", "created_at"]
    list_filter = ["project__organization", "project", "status", "priority"]
    search_fields = ["title", "asset", "owner"]
    list_select_related = ["project", "created_by"]
    readonly_fields = ["alarm", "created_by", "created_at", "updated_at"]
    autocomplete_fields = ["project"]
    inlines = [WorkItemEventInline]
