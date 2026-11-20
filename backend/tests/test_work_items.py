"""Bitácora compartida: aislamiento entre clientes, permisos por rol y registro de cambios."""

import pytest
from django.core.management import call_command
from django.test import Client
from django.utils import timezone

from apps.alarms.models import Alarm
from apps.operations.models import WorkItem
from apps.tenancy.models import Membership

from .test_alarms import member, send_water


@pytest.fixture
def seeded(db):
    call_command("seed_demo")


@pytest.fixture
def operator(seeded):
    return member("aguapozo", Membership.Role.OPERATOR, "operador@aguapozo.cl")


@pytest.fixture
def viewer(seeded):
    return member("aguapozo", Membership.Role.VIEWER, "lector@aguapozo.cl")


@pytest.fixture
def outsider(seeded):
    return member("ulagos", Membership.Role.ORG_ADMIN, "admin@ulagos.cl")


def post(client, url, data):
    return client.post(url, data, content_type="application/json")


def create(client, **data):
    return post(client, "/api/work-items", {"project": "aguapozo", "title": "Revisar sensor LT-101", **data})


@pytest.mark.django_db
class TestWorkItems:
    def test_operator_creates_and_everyone_in_the_project_sees_it(self, operator, viewer, outsider, client_for):
        response = create(client_for(operator), asset="LT-101", priority="high", owner="Gabriel", due_date="2026-12-01")
        assert response.status_code == 201
        item = response.json()
        assert item["project"] == "aguapozo"
        assert item["status"] == "pending"
        assert item["created_by"] == "operador@aguapozo.cl"
        assert [e["kind"] for e in item["events"]] == ["created"]
        assert [i["id"] for i in client_for(viewer).get("/api/work-items").json()] == [item["id"]]
        assert client_for(outsider).get("/api/work-items").json() == []
        assert client_for(outsider).get("/api/work-items?project=aguapozo").status_code == 404

    def test_viewer_and_outsider_cannot_write(self, operator, viewer, outsider, client_for):
        assert create(client_for(viewer)).status_code == 403
        assert create(client_for(outsider)).status_code == 404
        item_id = create(client_for(operator)).json()["id"]
        url = f"/api/work-items/{item_id}"
        assert client_for(viewer).patch(url, {"status": "resolved"}, content_type="application/json").status_code == 403
        assert post(client_for(viewer), f"{url}/notes", {"text": "Hola"}).status_code == 403
        assert (
            client_for(outsider).patch(url, {"status": "resolved"}, content_type="application/json").status_code == 404
        )
        assert WorkItem.objects.get().status == "pending"

    def test_changes_and_notes_are_logged_with_author(self, operator, client_for):
        client = client_for(operator)
        item_id = create(client).json()["id"]
        url = f"/api/work-items/{item_id}"
        item = client.patch(
            url, {"status": "in_progress", "owner": " Gabriel "}, content_type="application/json"
        ).json()
        assert item["status"] == "in_progress"
        assert item["owner"] == "Gabriel"
        assert [e["text"] for e in item["events"]][1:] == ["Estado cambiado a En atención", "Responsable: Gabriel"]
        # Un cambio sin diferencias no ensucia la bitácora.
        same = client.patch(url, {"status": "in_progress"}, content_type="application/json").json()
        assert len(same["events"]) == 3
        noted = post(client, f"{url}/notes", {"text": "Sensor limpiado; lectura estable."}).json()
        assert noted["events"][-1] == {
            "kind": "note",
            "text": "Sensor limpiado; lectura estable.",
            "author": "operador@aguapozo.cl",
            "created_at": noted["events"][-1]["created_at"],
        }
        assert post(client, f"{url}/notes", {"text": "   "}).status_code == 422

    def test_open_filter_hides_resolved(self, operator, client_for):
        client = client_for(operator)
        first = create(client).json()["id"]
        create(client, title="Otro")
        client.patch(f"/api/work-items/{first}", {"status": "resolved"}, content_type="application/json")
        assert [i["title"] for i in client.get("/api/work-items?status=open").json()] == ["Otro"]

    def test_item_can_come_from_an_alarm_of_the_same_project(self, operator, client_for, platform_admin):
        send_water(timezone.now(), chlorine=0.1)
        alarm = Alarm.objects.get()
        item = create(client_for(operator), alarm_id=alarm.id).json()
        assert item["alarm_id"] == alarm.id
        assert item["events"][0]["text"] == "Creado desde la alarma de AIT-101"
        # Una alarma de otro proyecto no se puede vincular.
        response = post(
            client_for(platform_admin),
            "/api/work-items",
            {
                "project": "medidores-electricos",
                "title": "x",
                "alarm_id": alarm.id,
            },
        )
        assert response.status_code == 404

    def test_post_requires_csrf_token(self, operator):
        client = Client(enforce_csrf_checks=True)
        client.force_login(operator)
        assert create(client).status_code == 403
        assert not WorkItem.objects.exists()
