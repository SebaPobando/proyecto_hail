from django import forms
from django.contrib import admin
from django.db.models import Count

from .models import Device, Project, Signal


class DeviceAdminForm(forms.ModelForm):
    new_mqtt_password = forms.CharField(
        label="Nueva contraseña MQTT",
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Déjala vacía para conservar la actual. Se guarda solo el hash.",
    )

    class Meta:
        model = Device
        fields = ["project", "code", "name", "kind", "hardware_model", "decoder", "mqtt_username", "is_active"]

    def save(self, commit=True):
        device = super().save(commit=False)
        if self.cleaned_data.get("new_mqtt_password"):
            device.set_mqtt_password(self.cleaned_data["new_mqtt_password"])
        if commit:
            device.save()
        return device


class DeviceInline(admin.TabularInline):
    model = Device
    extra = 0
    fields = ["code", "name", "kind", "hardware_model", "decoder", "is_active"]
    show_change_link = True


class SignalInline(admin.TabularInline):
    model = Signal
    autocomplete_fields = ["device"]
    extra = 0
    fields = ["position", "tag", "description", "kind", "unit", "device", "is_active"]
    show_change_link = True
    classes = ["collapse"]


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "hmi_type", "status", "is_active", "device_count", "signal_count"]
    list_filter = ["organization", "hmi_type", "status", "is_active"]
    search_fields = ["name", "slug", "organization__name"]
    prepopulated_fields = {"slug": ["name"]}
    autocomplete_fields = ["organization"]
    list_select_related = ["organization"]
    inlines = [DeviceInline, SignalInline]

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(_devices=Count("devices", distinct=True), _signals=Count("signals", distinct=True))
        )

    @admin.display(description="dispositivos", ordering="_devices")
    def device_count(self, obj):
        return obj._devices

    @admin.display(description="señales", ordering="_signals")
    def signal_count(self, obj):
        return obj._signals


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    form = DeviceAdminForm
    list_display = ["code", "name", "project", "kind", "decoder", "mqtt_username", "last_seen_at", "is_active"]
    list_filter = ["project__organization", "project", "kind", "decoder", "is_active"]
    search_fields = ["code", "name", "mqtt_username", "project__name"]
    autocomplete_fields = ["project"]
    list_select_related = ["project__organization"]
    readonly_fields = ["telemetry_topic", "last_seen_at", "has_mqtt_password"]

    @admin.display(description="tópico de telemetría")
    def telemetry_topic(self, obj):
        return obj.telemetry_topic if obj.pk else "—"

    @admin.display(description="contraseña MQTT definida", boolean=True)
    def has_mqtt_password(self, obj):
        return bool(obj.mqtt_password_hash)


@admin.register(Signal)
class SignalAdmin(admin.ModelAdmin):
    list_display = ["tag", "description", "project", "device", "kind", "unit", "address", "is_active"]
    list_filter = ["project__organization", "project", "kind", "is_active"]
    search_fields = ["tag", "description", "address", "field_device"]
    autocomplete_fields = ["project", "device"]
    list_select_related = ["project", "device"]
    list_per_page = 100
