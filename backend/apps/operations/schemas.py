from datetime import date, datetime

from ninja import Field, Schema

from .models import WorkItem


def display_name(user) -> str | None:
    return (user.get_full_name() or user.email) if user is not None else None


class WorkItemEventOut(Schema):
    kind: str
    text: str
    author: str | None
    created_at: datetime

    @staticmethod
    def resolve_author(obj) -> str | None:
        return display_name(obj.author)


class WorkItemOut(Schema):
    id: int
    project: str = Field(..., alias="project.slug")
    asset: str
    title: str
    priority: str
    status: str
    owner: str
    due_date: date | None
    alarm_id: int | None
    created_by: str | None
    created_at: datetime
    updated_at: datetime
    events: list[WorkItemEventOut]

    @staticmethod
    def resolve_created_by(obj) -> str | None:
        return display_name(obj.created_by)

    @staticmethod
    def resolve_events(obj):
        return list(obj.events.all())


class WorkItemIn(Schema):
    project: str
    title: str = Field(..., min_length=1, max_length=160)
    asset: str = Field("", max_length=40)
    priority: WorkItem.Priority = WorkItem.Priority.NORMAL
    owner: str = Field("", max_length=100)
    due_date: date | None = None
    alarm_id: int | None = None


class WorkItemPatch(Schema):
    status: WorkItem.Status | None = None
    priority: WorkItem.Priority | None = None
    owner: str | None = Field(None, max_length=100)
    due_date: date | None = None


class NoteIn(Schema):
    text: str = Field(..., min_length=1, max_length=1500)
