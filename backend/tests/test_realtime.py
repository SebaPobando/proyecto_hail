"""WebSocket de avisos en vivo: autenticación, Origin, aislamiento y avisos tras confirmar."""

import pytest
from asgiref.sync import async_to_sync, sync_to_async
from channels.testing import WebsocketCommunicator
from django.core.management import call_command
from django.test import Client
from django.utils import timezone

from apps.alarms.models import Alarm, AlarmRule
from apps.realtime import events
from apps.realtime.events import notify
from apps.tenancy.models import Membership
from config.asgi import application

from .test_alarms import member, send_water

ORIGIN = (b"origin", b"http://127.0.0.1:5173")


def communicator(user=None, origin=ORIGIN) -> WebsocketCommunicator:
    headers = [origin]
    if user is not None:
        client = Client()
        client.force_login(user)
        headers.append((b"cookie", f"sessionid={client.cookies['sessionid'].value}".encode()))
    return WebsocketCommunicator(application, "/ws/updates", headers=headers)


@pytest.mark.django_db(transaction=True)
class TestUpdatesSocket:
    def test_anonymous_is_rejected(self):
        async def scenario():
            ws = communicator()
            connected, code = await ws.connect()
            assert not connected
            assert code == 4401

        async_to_sync(scenario)()

    def test_foreign_origin_is_rejected(self, user_a):
        ws = communicator(user_a, origin=(b"origin", b"https://sitio-ajeno.example"))

        async def scenario():
            connected, _ = await ws.connect()
            assert not connected

        async_to_sync(scenario)()

    def test_events_reach_only_users_who_see_the_project(self, user_a, user_b, project_a, project_b):
        a, b = communicator(user_a), communicator(user_b)

        async def scenario():
            assert (await a.connect())[0]
            assert (await b.connect())[0]
            # Sin Redis los avisos no cruzan procesos: el navegador debe seguir consultando.
            assert await a.receive_json_from() == {"type": "hello", "live": False}
            assert await b.receive_json_from() == {"type": "hello", "live": False}
            await sync_to_async(notify)("planta-a", "alarms")
            assert await a.receive_json_from() == {"type": "event", "project": "planta-a", "kind": "alarms"}
            assert await b.receive_nothing()
            # Lo que envíe el navegador se ignora.
            await a.send_json_to({"type": "subscribe", "project": "planta-b"})
            await sync_to_async(notify)("planta-b", "telemetry")
            assert await a.receive_nothing()
            assert (await b.receive_json_from())["project"] == "planta-b"
            await a.disconnect()
            await b.disconnect()

        async_to_sync(scenario)()

    def test_live_flag_follows_settings(self, user_a, project_a, settings):
        settings.REALTIME_LIVE = True
        ws = communicator(user_a)

        async def scenario():
            await ws.connect()
            assert (await ws.receive_json_from())["live"] is True
            await ws.disconnect()

        async_to_sync(scenario)()


@pytest.fixture
def sent(monkeypatch):
    calls = []
    monkeypatch.setattr(events, "notify", lambda slug, kind: calls.append((slug, kind)))
    return calls


@pytest.mark.django_db
class TestNotifications:
    @pytest.fixture
    def seeded(self, db):
        call_command("seed_demo")
        AlarmRule.objects.update(on_delay=0)

    def test_ingest_notifies_after_commit(self, seeded, sent, django_capture_on_commit_callbacks):
        now = timezone.now()
        with django_capture_on_commit_callbacks(execute=True):
            send_water(now)
        assert sent == [("aguapozo", "telemetry")]
        with django_capture_on_commit_callbacks(execute=True):
            send_water(now.replace(microsecond=0) + timezone.timedelta(seconds=10), chlorine=0.1)
        assert sent[1:] == [("aguapozo", "telemetry"), ("aguapozo", "alarms")]

    def test_nothing_is_sent_if_the_transaction_rolls_back(self, seeded, sent, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=False) as callbacks:
            send_water(timezone.now())
        assert sent == []
        assert len(callbacks) == 1

    def test_acknowledge_and_work_items_notify(self, seeded, sent, client_for, django_capture_on_commit_callbacks):
        send_water(timezone.now(), chlorine=0.1)
        operator = member("aguapozo", Membership.Role.OPERATOR, "operador@aguapozo.cl")
        client = client_for(operator)
        alarm = Alarm.objects.get()
        sent.clear()
        with django_capture_on_commit_callbacks(execute=True):
            client.post(f"/api/alarms/{alarm.id}/acknowledge", {}, content_type="application/json")
            client.post("/api/work-items", {"project": "aguapozo", "title": "Revisar"}, content_type="application/json")
        assert sent == [("aguapozo", "alarms"), ("aguapozo", "work_items")]

    def test_a_broken_channel_layer_never_breaks_the_caller(self, monkeypatch):
        class Broken:
            async def group_send(self, *args):
                raise ConnectionError("Redis no responde")

        monkeypatch.setattr(events, "get_channel_layer", lambda: Broken())
        events.notify("aguapozo", "telemetry")  # no lanza
