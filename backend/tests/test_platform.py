import pytest
from django.core.management import call_command
from django.test import Client, override_settings

from apps.projects.models import Device, Project, Signal
from apps.tenancy.models import Organization


@pytest.mark.django_db
def test_health_is_public():
    assert Client().get("/api/health").json() == {"status": "ok"}


@pytest.mark.django_db
def test_openapi_schema_is_published():
    schema = Client().get("/api/openapi.json").json()
    assert "/api/projects" in schema["paths"]
    assert "/api/auth/login" in schema["paths"]


@pytest.mark.django_db
def test_seed_demo_is_idempotent():
    call_command("seed_demo")
    call_command("seed_demo")
    assert Organization.objects.count() == 3
    assert sorted(Project.objects.values_list("slug", flat=True)) == ["aguapozo", "medidores-electricos", "nutrial"]
    assert Device.objects.count() == 7
    assert Signal.objects.filter(project__slug="aguapozo").count() == 6
    assert Signal.objects.filter(project__slug="medidores-electricos").count() == 40
    assert Signal.objects.filter(project__slug="nutrial").count() == 58


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_demo_users_refused_outside_debug():
    from django.core.management.base import CommandError

    with pytest.raises(CommandError):
        call_command("seed_demo", "--demo-users")


@pytest.mark.django_db
def test_device_topic_and_password_hash():
    call_command("seed_demo")
    device = Device.objects.get(project__slug="aguapozo", code="cbox-01")
    assert device.telemetry_topic == "hail/aguapozo/aguapozo/cbox-01/telemetry"
    device.set_mqtt_password("secreto-del-equipo")
    assert device.mqtt_password_hash and "secreto-del-equipo" not in device.mqtt_password_hash


@pytest.mark.django_db
def test_admin_pages_render_for_superuser():
    from apps.accounts.models import User

    call_command("seed_demo")
    admin_user = User.objects.create_superuser("root@hail.cl", "clave-super-segura")
    client = Client()
    client.force_login(admin_user)
    project = Project.objects.get(slug="nutrial")
    device = Device.objects.filter(project=project).first()
    urls = [
        "/admin/",
        "/admin/tenancy/organization/",
        "/admin/tenancy/organization/add/",
        "/admin/tenancy/membership/",
        "/admin/projects/project/",
        f"/admin/projects/project/{project.pk}/change/",
        f"/admin/projects/device/{device.pk}/change/",
        "/admin/projects/signal/?project__id__exact=" + str(project.pk),
        "/admin/accounts/user/",
        "/admin/accounts/user/add/",
        "/admin/audit/auditlog/",
    ]
    for url in urls:
        assert client.get(url).status_code == 200, url


@pytest.mark.django_db
def test_admin_sets_mqtt_password_as_hash():
    from apps.accounts.models import User

    call_command("seed_demo")
    admin_user = User.objects.create_superuser("root@hail.cl", "clave-super-segura")
    client = Client()
    client.force_login(admin_user)
    device = Device.objects.get(code="cbox-01")
    form = {
        "project": device.project_id,
        "code": device.code,
        "name": device.name,
        "kind": device.kind,
        "hardware_model": device.hardware_model,
        "decoder": device.decoder,
        "mqtt_username": "cbox-aguapozo",
        "is_active": "on",
        "new_mqtt_password": "secreto-del-equipo",
    }
    response = client.post(f"/admin/projects/device/{device.pk}/change/", form)
    assert response.status_code == 302, response.content[:2000]
    device.refresh_from_db()
    assert device.mqtt_username == "cbox-aguapozo"
    assert device.mqtt_password_hash.startswith(("md5$", "pbkdf2_sha256$"))
