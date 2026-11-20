"""Alarmas: evaluación de reglas en la ingesta, ciclo ISA-18.2 y API con permisos."""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.models import User
from apps.alarms.models import Alarm, AlarmRule
from apps.audit.models import AuditLog
from apps.telemetry.services import ingest
from apps.tenancy.models import Membership, Organization

from .conftest import PASSWORD
from .test_telemetry import AGUAPOZO, MED01, payload_hail_v1, payload_test_v1


@pytest.fixture
def seeded(db):
    call_command("seed_demo")


@pytest.fixture
def now():
    return timezone.now()


def send_water(when, **values):
    return ingest(AGUAPOZO, payload_test_v1(when, **values), now=when)


def alarms_of(tag, condition=None):
    alarms = Alarm.objects.filter(rule__signal__tag=tag)
    if condition:
        alarms = alarms.filter(rule__condition=condition)
    return alarms


def member(org_slug: str, role: str, email: str) -> User:
    user = User.objects.create_user(email, PASSWORD)
    Membership.objects.create(user=user, organization=Organization.objects.get(slug=org_slug), role=role)
    return user


@pytest.mark.django_db
class TestEvaluation:
    def test_low_chlorine_raises_one_simulated_alarm(self, seeded, now):
        result = send_water(now, chlorine=0.15)
        assert result.alarms_raised == 1
        alarm = alarms_of("AIT-101", "low").get()
        assert alarm.raise_value == 0.15
        assert alarm.raised_at == now
        assert alarm.simulated is True
        assert alarm.state == Alarm.State.ACTIVE_UNACK
        # La condición sigue: no se duplica.
        send_water(now + timedelta(seconds=10), chlorine=0.12)
        assert alarms_of("AIT-101").count() == 1

    def test_deadband_avoids_chattering(self, seeded, now):
        send_water(now, chlorine=0.18)
        send_water(now + timedelta(seconds=10), chlorine=0.22)  # sobre el umbral, dentro de la banda (0,25)
        alarm = alarms_of("AIT-101", "low").get()
        assert alarm.cleared_at is None
        send_water(now + timedelta(seconds=20), chlorine=0.3)
        alarm.refresh_from_db()
        assert alarm.cleared_at == now + timedelta(seconds=20)
        assert alarm.clear_value == 0.3
        assert alarm.state == Alarm.State.CLEARED_UNACK

    def test_state_rule_follows_pump_fault(self, seeded, now):
        send_water(now, pump="fault", flow=0)
        alarm = alarms_of("P-101").get()
        assert alarm.raise_value == 2
        send_water(now + timedelta(seconds=10), pump="running")
        alarm.refresh_from_db()
        assert alarm.cleared_at is not None
        # Una nueva falla es una alarma nueva: el historial conserva ambas.
        send_water(now + timedelta(seconds=20), pump="fault", flow=0)
        assert alarms_of("P-101").count() == 2
        assert alarms_of("P-101").filter(cleared_at__isnull=True).count() == 1

    def test_late_message_does_not_raise(self, seeded, now):
        send_water(now)
        send_water(now - timedelta(minutes=5), chlorine=0.1)
        assert not alarms_of("AIT-101").exists()

    def test_bad_quality_neither_raises_nor_clears(self, seeded, now):
        ingest(MED01, payload_hail_v1(now, {"MED-01-F": {"value": 48.0, "quality": "bad"}}), now=now)
        assert not alarms_of("MED-01-F").exists()
        later = now + timedelta(seconds=10)
        ingest(MED01, payload_hail_v1(later, {"MED-01-F": 48.0}), now=later)
        alarm = alarms_of("MED-01-F", "low").get()
        assert alarm.simulated is False
        last = now + timedelta(seconds=20)
        ingest(MED01, payload_hail_v1(last, {"MED-01-F": {"value": 50.0, "quality": "bad"}}), now=last)
        alarm.refresh_from_db()
        assert alarm.cleared_at is None

    def test_disabled_rule_does_not_evaluate_and_clears_its_alarm(self, seeded, now):
        send_water(now, chlorine=0.1)
        rule = AlarmRule.objects.get(signal__tag="AIT-101", condition="low")
        rule.is_enabled = False
        rule.save()
        assert alarms_of("AIT-101").get().cleared_at is not None
        send_water(now + timedelta(seconds=10), chlorine=0.1)
        assert alarms_of("AIT-101").count() == 1

    def test_describe_uses_units_and_state_labels(self, seeded):
        assert AlarmRule.objects.get(signal__tag="AIT-101", condition="low").describe() == "≤ 0,2 mg/L"
        assert AlarmRule.objects.get(signal__tag="P-101").describe() == "= Falla"


@pytest.fixture
def water_alarm(seeded, now):
    send_water(now, chlorine=0.1)
    return alarms_of("AIT-101").get()


@pytest.mark.django_db
class TestAlarmApi:
    def test_lists_open_alarms_only_for_visible_projects(self, water_alarm, client_for):
        viewer = member("aguapozo", Membership.Role.VIEWER, "lector@aguapozo.cl")
        outsider = member("ulagos", Membership.Role.OPERATOR, "otro@ulagos.cl")
        data = client_for(viewer).get("/api/alarms").json()
        assert [a["id"] for a in data] == [water_alarm.id]
        assert data[0]["tag"] == "AIT-101"
        assert data[0]["condition"] == "≤ 0,2 mg/L"
        assert data[0]["priority"] == "high"
        assert data[0]["state"] == "active_unack"
        assert data[0]["simulated"] is True
        assert client_for(outsider).get("/api/alarms").json() == []
        assert client_for(outsider).get("/api/alarms?project=aguapozo").status_code == 404

    def test_viewer_cannot_acknowledge(self, water_alarm, client_for):
        viewer = member("aguapozo", Membership.Role.VIEWER, "lector@aguapozo.cl")
        response = client_for(viewer).post(
            f"/api/alarms/{water_alarm.id}/acknowledge", {}, content_type="application/json"
        )
        assert response.status_code == 403
        water_alarm.refresh_from_db()
        assert water_alarm.acknowledged_at is None

    def test_foreign_alarm_is_not_found(self, water_alarm, client_for):
        outsider = member("ulagos", Membership.Role.ORG_ADMIN, "admin@ulagos.cl")
        response = client_for(outsider).post(
            f"/api/alarms/{water_alarm.id}/acknowledge", {}, content_type="application/json"
        )
        assert response.status_code == 404

    def test_operator_acknowledges_once_and_it_is_audited(self, water_alarm, client_for, now):
        operator = member("aguapozo", Membership.Role.OPERATOR, "operador@aguapozo.cl")
        client = client_for(operator)
        url = f"/api/alarms/{water_alarm.id}/acknowledge"
        response = client.post(url, {"comment": "  Voy a revisar la dosificadora  "}, content_type="application/json")
        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "active_ack"
        assert body["acknowledged_by"] == "operador@aguapozo.cl"
        assert body["ack_comment"] == "Voy a revisar la dosificadora"
        assert client.post(url, {}, content_type="application/json").status_code == 409
        log = AuditLog.objects.get(action="alarm.acknowledged")
        assert log.actor == operator
        assert log.data["tag"] == "AIT-101"
        # Reconocida y luego normalizada: queda cerrada y sale de las abiertas.
        send_water(now + timedelta(seconds=10), chlorine=0.6)
        assert client.get("/api/alarms").json() == []
        history = client.get("/api/alarms?status=all").json()
        assert history[0]["state"] == "closed"

    def test_cleared_alarm_stays_open_until_acknowledged(self, water_alarm, client_for, now):
        send_water(now + timedelta(seconds=10), chlorine=0.6)
        operator = member("aguapozo", Membership.Role.OPERATOR, "operador@aguapozo.cl")
        client = client_for(operator)
        assert client.get("/api/alarms").json()[0]["state"] == "cleared_unack"
        client.post(f"/api/alarms/{water_alarm.id}/acknowledge", {}, content_type="application/json")
        assert client.get("/api/alarms").json() == []

    def test_summary_counts_open_alarms_per_project(self, seeded, client_for, platform_admin, now):
        send_water(now, chlorine=0.1, pump="fault", flow=0)
        ingest(MED01, payload_hail_v1(now, {"MED-01-THDV": 9.0}), now=now)
        summary = client_for(platform_admin).get("/api/alarms/summary").json()
        assert summary == [
            {"project": "aguapozo", "active": 2, "unacknowledged": 2, "open": 2, "highest_priority": "high"},
            {"project": "medidores-electricos", "active": 1, "unacknowledged": 1, "open": 1, "highest_priority": "low"},
        ]

    def test_platform_admin_can_acknowledge_anywhere(self, water_alarm, client_for, platform_admin):
        response = client_for(platform_admin).post(
            f"/api/alarms/{water_alarm.id}/acknowledge", {}, content_type="application/json"
        )
        assert response.status_code == 200

    def test_anonymous_is_rejected(self, water_alarm, client_for):
        assert client_for().get("/api/alarms").status_code == 401
        assert client_for().get("/api/alarms/summary").status_code == 401
