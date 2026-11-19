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
