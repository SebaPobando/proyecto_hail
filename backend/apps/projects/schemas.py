from ninja import ModelSchema, Schema

from .models import Device, Project, Signal


class OrganizationRefOut(Schema):
    slug: str
    name: str


class ProjectOut(ModelSchema):
    organization: OrganizationRefOut
    role: str

    class Meta:
        model = Project
        fields = ["slug", "name", "category", "description", "hmi_type", "status", "image", "is_active"]

    @staticmethod
    def resolve_role(obj, context) -> str:
        """Rol del usuario en el proyecto; "platform_admin" para el administrador global."""
        if context["request"].user.is_platform_admin:
            return "platform_admin"
        return getattr(obj, "user_role", None) or ""


class DeviceOut(ModelSchema):
    class Meta:
        model = Device
        fields = ["code", "name", "kind", "hardware_model", "last_seen_at"]


class ProjectDetailOut(ProjectOut):
    devices: list[DeviceOut]
    signal_count: int

    @staticmethod
    def resolve_devices(obj):
        return obj.devices.filter(is_active=True)


class SignalOut(ModelSchema):
    device: str | None

    class Meta:
        model = Signal
        fields = [
            "tag",
            "description",
            "kind",
            "unit",
            "min_value",
            "max_value",
            "decimals",
            "address",
            "module",
            "field_device",
            "logic",
            "position",
        ]

    @staticmethod
    def resolve_device(obj) -> str | None:
        return obj.device.code if obj.device_id else None
