"""Aislamiento entre clientes (punto 5 de docs/legacy/OPERACION.md).

Cubre: dos clientes, el administrador global y un usuario anónimo; lectura
cruzada, acceso directo por URL, revocación y desactivación.
"""

import pytest

from apps.projects.models import Project
from apps.tenancy.models import Membership


def slugs(response):
    assert response.status_code == 200, response.content
    return sorted(p["slug"] for p in response.json())


@pytest.mark.django_db
class TestProjectIsolation:
    def test_anonymous_gets_401_everywhere(self, client_for, project_a):
        client = client_for()
        for url in ["/api/projects", "/api/projects/planta-a", "/api/projects/planta-a/signals", "/api/auth/me"]:
            assert client.get(url).status_code == 401, url

    def test_client_sees_only_its_projects(self, client_for, user_a, project_a, project_b):
        assert slugs(client_for(user_a).get("/api/projects")) == ["planta-a"]

    def test_other_client_project_is_404_by_direct_url(self, client_for, user_a, project_a, project_b):
        client = client_for(user_a)
        assert client.get("/api/projects/planta-b").status_code == 404
        assert client.get("/api/projects/planta-b/signals").status_code == 404

    def test_unknown_and_foreign_projects_answer_the_same(self, client_for, user_a, project_b):
        client = client_for(user_a)
        foreign = client.get("/api/projects/planta-b")
        missing = client.get("/api/projects/no-existe")
        assert foreign.status_code == missing.status_code == 404
        assert foreign.json() == missing.json()

    def test_client_reads_own_detail_and_signals(self, client_for, user_a, project_a):
        client = client_for(user_a)
        detail = client.get("/api/projects/planta-a").json()
        assert detail["organization"]["slug"] == "cliente-a"
        assert detail["role"] == Membership.Role.OPERATOR
        assert detail["signal_count"] == 1
        tags = [s["tag"] for s in client.get("/api/projects/planta-a/signals").json()]
        assert tags == ["PLANTA-A-LT-101"]

    def test_platform_admin_sees_every_project(self, client_for, platform_admin, project_a, project_b):
        client = client_for(platform_admin)
        assert slugs(client.get("/api/projects")) == ["planta-a", "planta-b"]
        assert client.get("/api/projects/planta-b").json()["role"] == "platform_admin"

    def test_revoking_membership_removes_access(self, client_for, user_a, project_a):
        client = client_for(user_a)
        assert client.get("/api/projects/planta-a").status_code == 200
        Membership.objects.filter(user=user_a).delete()
        assert slugs(client.get("/api/projects")) == []
        assert client.get("/api/projects/planta-a").status_code == 404

    def test_inactive_organization_hides_its_projects(self, client_for, user_a, org_a, project_a):
        org_a.is_active = False
        org_a.save()
        assert slugs(client_for(user_a).get("/api/projects")) == []

    def test_inactive_project_hidden_for_client_visible_for_admin(self, client_for, user_a, platform_admin, project_a):
        Project.objects.filter(pk=project_a.pk).update(is_active=False)
        assert client_for(user_a).get("/api/projects/planta-a").status_code == 404
        assert client_for(platform_admin).get("/api/projects/planta-a").status_code == 200

    def test_inactive_user_sees_nothing(self, user_a, project_a):
        user_a.is_active = False
        assert Project.objects.for_user(user_a).count() == 0

    def test_user_in_two_organizations_sees_both_without_duplicates(
        self, client_for, user_a, org_b, project_a, project_b
    ):
        Membership.objects.create(user=user_a, organization=org_b)
        assert slugs(client_for(user_a).get("/api/projects")) == ["planta-a", "planta-b"]


@pytest.mark.django_db
def test_project_list_query_count_does_not_grow(client_for, user_a, org_a, django_assert_max_num_queries):
    from .conftest import make_project

    client = client_for(user_a)
    make_project(org_a, "planta-1")
    with django_assert_max_num_queries(4) as few:
        client.get("/api/projects")
    for n in range(2, 8):
        make_project(org_a, f"planta-{n}")
    with django_assert_max_num_queries(len(few.captured_queries)):
        assert len(client.get("/api/projects").json()) == 7


@pytest.mark.django_db
def test_detail_counts_only_active_signals_and_devices(client_for, user_a, project_a):
    project_a.signals.update(is_active=False)
    project_a.devices.create(code="gw-02", name="Gateway de respaldo", is_active=False)
    detail = client_for(user_a).get("/api/projects/planta-a").json()
    assert detail["signal_count"] == 0
    assert [d["code"] for d in detail["devices"]] == ["gw-01"]
