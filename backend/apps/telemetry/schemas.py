from datetime import datetime

from ninja import Schema


class LatestOut(Schema):
    tag: str
    description: str
    kind: str
    unit: str
    decimals: int
    value: float | None
    state_label: str | None
    quality: str | None
    time: datetime | None
    stale: bool


class LatestSnapshotOut(Schema):
    server_time: datetime
    stale_after_seconds: int
    readings: list[LatestOut]


class HistoryPointOut(Schema):
    time: datetime  # inicio del intervalo
    avg: float
    min: float
    max: float
    count: int


class HistorySeriesOut(Schema):
    tag: str
    unit: str
    points: list[HistoryPointOut]


class HistoryOut(Schema):
    start: datetime
    end: datetime
    bucket_seconds: int
    series: list[HistorySeriesOut]


class ErrorOut(Schema):
    detail: str


class WorkerOut(Schema):
    online: bool
    broker_connected: bool
    last_heartbeat: datetime
    last_message_at: datetime | None
    # Solo para el administrador global: son totales de toda la plataforma.
    messages_accepted: int | None = None
    messages_rejected: int | None = None


class DeviceStatusOut(Schema):
    code: str
    name: str
    kind: str
    last_seen_at: datetime | None
    online: bool


class ConnectivityOut(Schema):
    server_time: datetime
    offline_after_seconds: int
    worker: WorkerOut | None
    devices: list[DeviceStatusOut]
