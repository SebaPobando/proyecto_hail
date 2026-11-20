from datetime import datetime

from ninja import Field, Schema


class AlarmOut(Schema):
    id: int
    project: str = Field(..., alias="project.slug")
    project_name: str = Field(..., alias="project.name")
    tag: str
    description: str
    unit: str
    kind: str
    condition: str
    priority: str = Field(..., alias="rule.priority")
    message: str = Field(..., alias="rule.message")
    state: str
    raised_at: datetime
    raise_value: float | None
    cleared_at: datetime | None
    clear_value: float | None
    acknowledged_at: datetime | None
    acknowledged_by: str | None
    ack_comment: str
    simulated: bool

    @staticmethod
    def resolve_tag(obj) -> str:
        return obj.rule.subject

    @staticmethod
    def resolve_description(obj) -> str:
        rule = obj.rule
        return rule.signal.description if rule.signal_id else f"{rule.device.name}: comunicación"

    @staticmethod
    def resolve_unit(obj) -> str:
        return obj.rule.unit

    @staticmethod
    def resolve_kind(obj) -> str:
        """ "signal" o "communication", para que la pantalla presente el valor como corresponde."""
        return "communication" if obj.rule.condition == "comm" else "signal"

    @staticmethod
    def resolve_condition(obj) -> str:
        return obj.rule.describe()

    @staticmethod
    def resolve_acknowledged_by(obj) -> str | None:
        user = obj.acknowledged_by
        if user is None:
            return None
        return user.get_full_name() or user.email


class AcknowledgeIn(Schema):
    comment: str = Field("", max_length=500)


class ProjectAlarmSummary(Schema):
    project: str
    active: int
    unacknowledged: int
    open: int
    highest_priority: str | None
