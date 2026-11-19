"""Ingesta de telemetría y endpoints latest / history (punto 3 de docs/legacy/OPERACION.md)."""

import json
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.models import User
from apps.projects.models import Device, Project
from apps.telemetry.decoders import DecodeError, decode_hail_v1, decode_test_v1
from apps.telemetry.management.commands.ingest_mqtt import handle_message
from apps.telemetry.models import LatestReading, Quality, Reading
from apps.telemetry.services import IngestError, ingest
from apps.tenancy.models import Membership, Organization

AGUAPOZO = "hail/aguapozo/aguapozo/cbox-01/telemetry"
MED01 = "hail/ulagos/medidores-electricos/med-01/telemetry"


def payload_test_v1(when, **overrides) -> bytes:
    message = {
        "version": 1,
        "timestamp": when.isoformat(),
        "level": 68.0,
        "wellWaterDepthM": 12.0,
        "flow": 12.4,
        "chlorine": 0.65,
        "pump": "running",
        "dosing": "active",
    }
    message.update(overrides)
    return json.dumps(message).encode()


def payload_hail_v1(when, values, **extra) -> bytes:
    return json.dumps({"v": 1, "ts": when.isoformat(), "values": values, **extra}).encode()


@pytest.fixture
def seeded(db):
    call_command("seed_demo")


@pytest.fixture
def now():
    return timezone.now()


def latest(tag):
    return LatestReading.objects.get(signal__tag=tag)


# --- Decodificadores -------------------------------------------------------


class TestDecoders:
    def test_test_v1_maps_states_and_marks_simulated(self, now):
        sample = decode_test_v1(payload_test_v1(now, pump="fault", dosing="inactive"))
        assert sample.values["P-101"] == (2.0, Quality.SIMULATED)
        assert sample.values["D-101"] == (0.0, Quality.SIMULATED)
        assert sample.values["LT-101"] == (68.0, Quality.SIMULATED)

    @pytest.mark.parametrize(
        "payload",
        [
            b"no es json",
            b"[1, 2]",
            json.dumps({"version": 2}).encode(),
            json.dumps({"version": 1, "timestamp": "2026-11-19T10:00:00"}).encode(),  # sin zona horaria
        ],
    )
    def test_test_v1_rejects_malformed(self, payload):
        with pytest.raises(DecodeError):
            decode_test_v1(payload)

    def test_test_v1_rejects_unknown_state(self, now):
        with pytest.raises(DecodeError):
            decode_test_v1(payload_test_v1(now, pump="girando"))

    def test_hail_v1_per_value_quality(self, now):
        sample = decode_hail_v1(payload_hail_v1(now, {"A": 1, "B": {"value": 2.5, "quality": "uncertain"}}))
        assert sample.values == {"A": (1.0, "good"), "B": (2.5, "uncertain")}

    @pytest.mark.parametrize(
        "values",
        [{}, {"A": "1"}, {"A": True}, {"A": {"value": 1, "quality": "excelente"}}],
    )
    def test_hail_v1_rejects_bad_values(self, now, values):
        with pytest.raises(DecodeError):
            decode_hail_v1(payload_hail_v1(now, values))

    def test_hail_v1_rejects_non_finite(self, now):
        payload = b'{"v": 1, "ts": "%s", "values": {"A": NaN}}' % now.isoformat().encode()
        with pytest.raises(DecodeError):
            decode_hail_v1(payload)


# --- Ingesta -----------------------------------------------------------------


@pytest.mark.django_db
class TestIngest:
    def test_valid_message_stores_history_latest_and_last_seen(self, seeded, now):
        result = ingest(AGUAPOZO, payload_test_v1(now), now=now)
        assert result.accepted == 6 and result.rejected == {}
        assert Reading.objects.filter(signal__project__slug="aguapozo").count() == 6
        assert latest("LT-101").value == 68.0
        assert Device.objects.get(code="cbox-01").last_seen_at == now

    @pytest.mark.parametrize(
        "topic",
        [
            "hail/ulagos/aguapozo/cbox-01/telemetry",  # organización que no es la dueña
            "hail/aguapozo/nutrial/cbox-01/telemetry",  # proyecto equivocado
            "hail/aguapozo/aguapozo/no-existe/telemetry",
            "hail/aguapozo/aguapozo/cbox-01/status",
            "otro/aguapozo/aguapozo/cbox-01/telemetry",
            "hail/aguapozo/aguapozo/telemetry",
        ],
    )
    def test_topic_must_match_device_project_and_org(self, seeded, now, topic):
        with pytest.raises(IngestError):
            ingest(topic, payload_test_v1(now), now=now)
        assert not Reading.objects.exists()

    def test_inactive_device_project_or_org_is_rejected(self, seeded, now):
        Organization.objects.filter(slug="aguapozo").update(is_active=False)
        with pytest.raises(IngestError):
            ingest(AGUAPOZO, payload_test_v1(now), now=now)
        Organization.objects.filter(slug="aguapozo").update(is_active=True)
        Device.objects.filter(code="cbox-01").update(is_active=False)
        with pytest.raises(IngestError):
            ingest(AGUAPOZO, payload_test_v1(now), now=now)

    def test_device_without_decoder_is_rejected(self, seeded, now):
        with pytest.raises(IngestError, match="decodificador"):
            ingest("hail/nutrial/nutrial/plc-01/telemetry", payload_hail_v1(now, {"DI_Reset": 1}), now=now)

    def test_out_of_range_value_is_dropped_without_losing_the_rest(self, seeded, now):
        result = ingest(AGUAPOZO, payload_test_v1(now, level=150.0), now=now)
        assert "LT-101" in result.rejected
        assert result.accepted == 5
        assert not LatestReading.objects.filter(signal__tag="LT-101").exists()

    @pytest.mark.parametrize("offset", [timedelta(seconds=30), timedelta(days=-8)])
    def test_timestamp_outside_window_is_rejected(self, seeded, now, offset):
        with pytest.raises(IngestError, match="ventana"):
            ingest(AGUAPOZO, payload_test_v1(now + offset), now=now)

    def test_duplicate_message_is_ignored(self, seeded, now):
        ingest(AGUAPOZO, payload_test_v1(now), now=now)
        ingest(AGUAPOZO, payload_test_v1(now, level=70.0), now=now)
        assert Reading.objects.filter(signal__tag="LT-101").count() == 1
        assert latest("LT-101").value == 68.0

    def test_late_message_fills_history_but_never_rewinds_latest(self, seeded, now):
        ingest(AGUAPOZO, payload_test_v1(now, level=69.0), now=now)
        ingest(AGUAPOZO, payload_test_v1(now - timedelta(minutes=5), level=60.0), now=now)
        assert Reading.objects.filter(signal__tag="LT-101").count() == 2
        assert latest("LT-101").value == 69.0

    def test_tags_from_another_device_are_rejected(self, seeded, now):
        result = ingest(MED01, payload_hail_v1(now, {"MED-01-VAN": 231.0, "MED-02-VAN": 230.0, "X": 1}), now=now)
        assert result.accepted == 1
        assert set(result.rejected) == {"MED-02-VAN", "X"}

    def test_oversized_payload_is_rejected(self, seeded, now):
        with pytest.raises(IngestError, match="grande"):
            ingest(MED01, b"x" * (64 * 1024 + 1), now=now)

    def test_worker_handler_never_raises(self, seeded, caplog, monkeypatch):
        # Dentro de la transacción de la prueba, close_old_connections cerraría la conexión.
        monkeypatch.setattr("apps.telemetry.management.commands.ingest_mqtt.close_old_connections", lambda: None)
        handle_message("hail/x/y/z/telemetry", b"basura")
        handle_message(AGUAPOZO, b"basura")
        assert "rechazado" in caplog.text


@pytest.mark.django_db
def test_simulator_direct_mode_feeds_aguapozo_and_meters(seeded):
    call_command("simulate_telemetry", "--direct", "--count", "2", "--interval", "0", "--seed", "7")
    assert Reading.objects.filter(signal__project__slug="aguapozo").count() == 12
    assert Reading.objects.filter(signal__project__slug="medidores-electricos").count() == 2 * 3 * 8
    assert not Reading.objects.filter(signal__device__code__in=["med-04", "med-05"]).exists()
    assert set(Reading.objects.values_list("quality", flat=True)) == {Quality.SIMULATED}


# --- API ---------------------------------------------------------------------


@pytest.fixture
def aguapozo_client(seeded, client_for):
    user = User.objects.create_user("operador@aguapozo.cl", "clave-de-prueba-segura")
    Membership.objects.create(user=user, organization=Organization.objects.get(slug="aguapozo"))
    return client_for(user)


@pytest.mark.django_db
class TestLatestApi:
    def test_snapshot_lists_every_signal_with_state_labels(self, aguapozo_client, now):
        ingest(AGUAPOZO, payload_test_v1(now, pump="fault"), now=now)
        data = aguapozo_client.get("/api/projects/aguapozo/latest").json()
        readings = {r["tag"]: r for r in data["readings"]}
        assert len(readings) == 6
        assert readings["P-101"]["state_label"] == "Falla"
        assert readings["LT-101"]["stale"] is False
        assert readings["LT-101"]["quality"] == "simulated"

    def test_signals_without_data_are_null_and_stale(self, aguapozo_client):
        readings = aguapozo_client.get("/api/projects/aguapozo/latest").json()["readings"]
        assert all(r["value"] is None and r["stale"] for r in readings)

    def test_old_reading_is_marked_stale(self, aguapozo_client, now):
        ingest(AGUAPOZO, payload_test_v1(now - timedelta(seconds=45)), now=now)
        readings = aguapozo_client.get("/api/projects/aguapozo/latest").json()["readings"]
        assert all(r["stale"] for r in readings)
        assert readings[0]["value"] == 68.0  # el valor se conserva, marcado como vencido

    def test_foreign_and_anonymous_access(self, aguapozo_client, client_for):
        assert aguapozo_client.get("/api/projects/medidores-electricos/latest").status_code == 404
        assert (
            aguapozo_client.get(
                "/api/projects/medidores-electricos/history?tags=MED-01-P&start=2026-01-01T00:00:00Z"
            ).status_code
            == 404
        )
        assert client_for().get("/api/projects/aguapozo/latest").status_code == 401


@pytest.mark.django_db
class TestHistoryApi:
    def fill(self, now, minutes=10):
        for minute in range(minutes):
            when = now - timedelta(minutes=minutes - minute)
            ingest(AGUAPOZO, payload_test_v1(when, level=60.0 + minute), now=now)

    def get(self, client, **params):
        return client.get("/api/projects/aguapozo/history", params)

    def test_buckets_have_avg_min_max_and_count(self, aguapozo_client, now):
        self.fill(now)
        start = now - timedelta(minutes=10)
        response = self.get(
            aguapozo_client, tags=["LT-101", "FT-101"], start=start.isoformat(), end=now.isoformat(), points=5
        )
        assert response.status_code == 200
        body = response.json()
        assert body["bucket_seconds"] == 120
        level = body["series"][0]
        assert level["tag"] == "LT-101" and level["unit"] == "%"
        assert [p["count"] for p in level["points"]] == [2, 2, 2, 2, 2]
        first = level["points"][0]
        assert (first["min"], first["max"], first["avg"]) == (60.0, 61.0, 60.5)
        assert sum(p["count"] for p in body["series"][1]["points"]) == 10

    def test_empty_buckets_are_omitted(self, aguapozo_client, now):
        ingest(AGUAPOZO, payload_test_v1(now - timedelta(minutes=1)), now=now)
        start = now - timedelta(hours=1)
        points = self.get(aguapozo_client, tags=["LT-101"], start=start.isoformat(), end=now.isoformat()).json()
        assert len(points["series"][0]["points"]) == 1

    @pytest.mark.parametrize(
        "params, message",
        [
            ({"tags": ["LT-101"], "start": "2026-01-01T00:00:00Z", "end": "2026-03-01T00:00:00Z"}, "31 días"),
            ({"tags": ["LT-101"], "start": "2026-01-02T00:00:00Z", "end": "2026-01-01T00:00:00Z"}, "posterior"),
            (
                {"tags": ["LT-101", "MED-01-P"], "start": "2026-01-01T00:00:00Z", "end": "2026-01-02T00:00:00Z"},
                "MED-01-P",
            ),
            ({"tags": ["LT-101"], "start": "2026-01-01T00:00:00"}, "zona horaria"),
        ],
    )
    def test_invalid_queries_are_rejected_not_truncated(self, aguapozo_client, params, message):
        response = self.get(aguapozo_client, **params)
        assert response.status_code == 400
        assert message in response.json()["detail"]

    def test_inactive_project_history_is_hidden_from_client(self, aguapozo_client):
        Project.objects.filter(slug="aguapozo").update(is_active=False)
        response = self.get(aguapozo_client, tags=["LT-101"], start="2026-01-01T00:00:00Z")
        assert response.status_code == 404

    def test_latest_query_count_is_constant(self, aguapozo_client, now, django_assert_max_num_queries):
        ingest(AGUAPOZO, payload_test_v1(now), now=now)
        with django_assert_max_num_queries(6):
            aguapozo_client.get("/api/projects/aguapozo/latest")
