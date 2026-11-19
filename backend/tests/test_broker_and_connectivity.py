"""Credenciales del broker (passwd/acl) y estado de conectividad."""

import base64
import hashlib
from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.core.management import CommandError, call_command
from django.utils import timezone

from apps.accounts.models import User
from apps.projects.models import Device
from apps.telemetry.broker_auth import build_broker_files, mosquitto_hash
from apps.telemetry.management.commands.ingest_mqtt import Counters, write_heartbeat
from apps.telemetry.models import WorkerStatus
from apps.tenancy.models import Membership, Organization


def verify_mosquitto_hash(stored: str, password: str) -> bool:
    """Misma verificación que hace Mosquitto con el formato $7$."""
    _, kind, iterations, salt, digest = stored.split("$")
    expected = base64.b64decode(digest)
    computed = hashlib.pbkdf2_hmac("sha512", password.encode(), base64.b64decode(salt), int(iterations), len(expected))
    return kind == "7" and computed == expected


@pytest.fixture
def seeded(db):
    call_command("seed_demo")


@pytest.fixture
def broker_settings(settings):
    settings.MQTT_USERNAME = "hail-ingest"
    settings.MQTT_PASSWORD = "clave-ingesta"
    settings.MQTT_SIMULATOR_USERNAME = "hail-simulator"
    settings.MQTT_SIMULATOR_PASSWORD = ""
    return settings


def give_credentials(code: str, username: str, password: str = "clave-equipo") -> Device:
    device = Device.objects.get(code=code)
    device.mqtt_username = username
    device.set_mqtt_password(password)
    device.save()
    return device


class TestMosquittoHash:
    def test_hash_verifies_like_mosquitto(self):
        stored = mosquitto_hash("secreto-123")
        assert stored.startswith("$7$20000$")
        assert verify_mosquitto_hash(stored, "secreto-123")
        assert not verify_mosquitto_hash(stored, "otra")

    def test_matches_mosquitto_passwd_reference(self):
        # Línea generada con `mosquitto_passwd -b` (Mosquitto 2.0.18) para la clave "secreto-123".
        reference = (
            "$7$101$yIdKkWkdgDMie50L$"
            "sSzizEmlK9kpWzYR+XBs/AvTHv1I8Wr+SxzBehvaahQlTkXr8hlYCc7pIMZSDXQfoR1A/vvF8xiNcjFi9OZ4WA=="
        )
        salt = base64.b64decode(reference.split("$")[3])
        assert mosquitto_hash("secreto-123", iterations=101, salt=salt) == reference


@pytest.mark.django_db
class TestBrokerFiles:
    def test_each_device_writes_only_its_topic(self, seeded, broker_settings):
        give_credentials("cbox-01", "cbox-aguapozo")
        files = build_broker_files()
        assert "user hail-ingest\ntopic read hail/+/+/+/telemetry\n" in files.acl
        assert "user cbox-aguapozo\ntopic write hail/aguapozo/aguapozo/cbox-01/telemetry\n" in files.acl
        line = next(line for line in files.passwd.splitlines() if line.startswith("cbox-aguapozo:"))
        assert verify_mosquitto_hash(line.split(":", 1)[1], "clave-equipo")
        assert "clave-equipo" not in files.passwd

    def test_devices_without_credentials_or_inactive_are_left_out(self, seeded, broker_settings):
        give_credentials("cbox-01", "cbox-aguapozo")
        give_credentials("med-01", "med-01-ulagos")
        Organization.objects.filter(slug="ulagos").update(is_active=False)
        files = build_broker_files()
        assert "med-01-ulagos" not in files.passwd
        assert "hail/nutrial/nutrial/plc-01/telemetry" in files.skipped

    def test_simulator_account_only_when_password_is_set(self, seeded, broker_settings):
        assert "hail-simulator" not in build_broker_files().passwd
        broker_settings.MQTT_SIMULATOR_PASSWORD = "clave-sim"
        assert "user hail-simulator\ntopic write hail/+/+/+/telemetry\n" in build_broker_files().acl

    def test_device_cannot_take_a_service_account_name(self, seeded, broker_settings):
        give_credentials("cbox-01", "hail-ingest")
        with pytest.raises(ValueError, match="reservado"):
            build_broker_files()

    def test_username_validation(self, seeded):
        device = Device.objects.get(code="cbox-01")
        device.mqtt_username = "con espacio:y-dos-puntos"
        with pytest.raises(ValidationError):
            device.full_clean()

    def test_command_writes_both_files(self, seeded, broker_settings, tmp_path):
        give_credentials("cbox-01", "cbox-aguapozo")
        call_command("mqtt_sync_auth", "--output", str(tmp_path))
        assert (tmp_path / "passwd").read_text().count("\n") == 2
        assert "cbox-aguapozo" in (tmp_path / "acl").read_text()

    def test_command_refuses_without_ingest_account(self, seeded, broker_settings, tmp_path):
        broker_settings.MQTT_PASSWORD = ""
        with pytest.raises(CommandError, match="HAIL_MQTT_USERNAME"):
            call_command("mqtt_sync_auth", "--output", str(tmp_path))


@pytest.fixture(autouse=True)
def keep_test_connection(monkeypatch):
    # Dentro de la transacción de la prueba, close_old_connections cerraría la conexión.
    monkeypatch.setattr("apps.telemetry.management.commands.ingest_mqtt.close_old_connections", lambda: None)


@pytest.fixture
def client_user(seeded, client_for):
    user = User.objects.create_user("operador@aguapozo.cl", "clave-de-prueba-segura")
    Membership.objects.create(user=user, organization=Organization.objects.get(slug="aguapozo"))
    return client_for(user)


@pytest.mark.django_db
class TestConnectivity:
    url = "/api/projects/aguapozo/connectivity"

    def test_without_worker_and_without_messages(self, client_user):
        data = client_user.get(self.url).json()
        assert data["worker"] is None
        assert data["devices"] == [
            {
                "code": "cbox-01",
                "name": "Gateway Haiwell CBOX",
                "kind": "gateway",
                "last_seen_at": None,
                "online": False,
            }
        ]

    def test_worker_heartbeat_and_device_online(self, client_user):
        counters = Counters()
        counters.connected = True
        counters.record(True)
        counters.record(False)
        write_heartbeat(timezone.now(), counters)
        Device.objects.filter(code="cbox-01").update(last_seen_at=timezone.now())
        data = client_user.get(self.url).json()
        assert data["worker"]["online"] is True
        assert data["worker"]["broker_connected"] is True
        assert data["devices"][0]["online"] is True
        # Los totales son de toda la plataforma: un cliente no los ve.
        assert data["worker"]["messages_accepted"] is None

    def test_old_heartbeat_means_worker_offline(self, client_user):
        old = timezone.now() - timedelta(minutes=5)
        WorkerStatus.objects.create(name="ingest", started_at=old, last_heartbeat=old, broker_connected=True)
        Device.objects.filter(code="cbox-01").update(last_seen_at=old)
        data = client_user.get(self.url).json()
        assert data["worker"]["online"] is False
        assert data["worker"]["broker_connected"] is False  # un pulso viejo no puede afirmar conexión
        assert data["devices"][0]["online"] is False

    def test_platform_admin_sees_totals(self, seeded, client_for):
        counters = Counters()
        counters.record(True)
        write_heartbeat(timezone.now(), counters)
        admin = User.objects.create_user("seba@hail.cl", "clave-de-prueba-segura", is_staff=True)
        worker = client_for(admin).get(self.url).json()["worker"]
        assert (worker["messages_accepted"], worker["messages_rejected"]) == (1, 0)

    def test_foreign_project_is_404(self, client_user):
        assert client_user.get("/api/projects/nutrial/connectivity").status_code == 404


def test_heartbeat_survives_database_outage(monkeypatch, caplog):
    from django.db import OperationalError

    from apps.telemetry.management.commands import ingest_mqtt

    def database_down(*args, **kwargs):
        raise OperationalError("connection failed: la base no responde\ndetalle")

    monkeypatch.setattr(ingest_mqtt, "_save_heartbeat", database_down)
    assert ingest_mqtt.write_heartbeat(timezone.now(), Counters()) is False
    assert "No se pudo escribir el pulso" in caplog.text
