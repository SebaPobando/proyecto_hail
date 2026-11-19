import pytest
from django.test import Client

from apps.accounts.models import User
from apps.projects.models import Device, Project, Signal
from apps.tenancy.models import Membership, Organization

PASSWORD = "clave-de-prueba-segura"


def make_project(org: Organization, slug: str, **extra) -> Project:
    project = Project.objects.create(organization=org, slug=slug, name=slug.title(), **extra)
    device = Device.objects.create(project=project, code="gw-01", name="Gateway")
    Signal.objects.create(project=project, device=device, tag=f"{slug.upper()}-LT-101", unit="%")
    return project


@pytest.fixture
def org_a(db):
    return Organization.objects.create(name="Cliente A", slug="cliente-a")


@pytest.fixture
def org_b(db):
    return Organization.objects.create(name="Cliente B", slug="cliente-b")


@pytest.fixture
def project_a(org_a):
    return make_project(org_a, "planta-a")


@pytest.fixture
def project_b(org_b):
    return make_project(org_b, "planta-b")


@pytest.fixture
def user_a(org_a):
    user = User.objects.create_user("ana@cliente-a.cl", PASSWORD)
    Membership.objects.create(user=user, organization=org_a, role=Membership.Role.OPERATOR)
    return user


@pytest.fixture
def user_b(org_b):
    user = User.objects.create_user("beto@cliente-b.cl", PASSWORD)
    Membership.objects.create(user=user, organization=org_b)
    return user


@pytest.fixture
def platform_admin(db):
    return User.objects.create_user("seba@hail.cl", PASSWORD, is_staff=True)


@pytest.fixture
def client_for():
    def _client(user=None) -> Client:
        client = Client()
        if user is not None:
            client.force_login(user)
        return client

    return _client
