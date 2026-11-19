import re

import pytest
from django.core import mail
from django.test import Client

from apps.audit.models import AuditLog
from apps.tenancy.models import Membership

from .conftest import PASSWORD


def csrf_client() -> tuple[Client, str]:
    client = Client(enforce_csrf_checks=True)
    token = client.get("/api/auth/csrf").json()["csrf_token"]
    return client, token


def post(client: Client, url: str, data: dict, token: str | None = None):
    headers = {"X-CSRFToken": token} if token else {}
    return client.post(url, data, content_type="application/json", headers=headers)


@pytest.mark.django_db
class TestLogin:
    def test_login_requires_csrf_token(self, user_a):
        client = Client(enforce_csrf_checks=True)
        response = post(client, "/api/auth/login", {"email": user_a.email, "password": PASSWORD})
        assert response.status_code == 403

    def test_login_me_logout_flow(self, user_a, project_a):
        client, token = csrf_client()
        response = post(client, "/api/auth/login", {"email": "ANA@cliente-a.cl", "password": PASSWORD}, token)
        assert response.status_code == 200
        body = response.json()
        assert body["email"] == user_a.email
        assert body["is_platform_admin"] is False
        assert body["organizations"] == [{"slug": "cliente-a", "name": "Cliente A", "role": "operator"}]

        token = client.cookies["csrftoken"].value  # Django rota el token al iniciar sesión
        assert client.get("/api/auth/me").status_code == 200
        assert post(client, "/api/auth/logout", {}, token).status_code == 204
        assert client.get("/api/auth/me").status_code == 401

    def test_logout_with_session_but_without_csrf_is_rejected(self, user_a):
        client = Client(enforce_csrf_checks=True)
        client.force_login(user_a)
        assert post(client, "/api/auth/logout", {}).status_code == 403
        assert client.get("/api/auth/me").status_code == 200

    def test_wrong_password_is_401_and_audited(self, user_a):
        client, token = csrf_client()
        response = post(client, "/api/auth/login", {"email": user_a.email, "password": "otra"}, token)
        assert response.status_code == 401
        failed = AuditLog.objects.get(action="auth.login_failed")
        assert failed.data == {"email": user_a.email}

    def test_successful_login_is_audited(self, user_a):
        client, token = csrf_client()
        post(client, "/api/auth/login", {"email": user_a.email, "password": PASSWORD}, token)
        assert AuditLog.objects.filter(action="auth.login", actor=user_a).exists()


@pytest.mark.django_db
class TestPasswordReset:
    def test_unknown_email_answers_the_same_and_sends_nothing(self):
        client, token = csrf_client()
        response = post(client, "/api/auth/password-reset", {"email": "nadie@x.cl"}, token)
        assert response.status_code == 202
        assert mail.outbox == []

    def test_full_reset_flow(self, user_a):
        client, token = csrf_client()
        assert post(client, "/api/auth/password-reset", {"email": user_a.email}, token).status_code == 202
        assert len(mail.outbox) == 1
        link = re.search(r"https://hail\.test/#reset\?uid=(\S+)&token=(\S+)", mail.outbox[0].body)
        assert link, mail.outbox[0].body
        uid, reset_token = link.groups()

        weak = {"uid": uid, "token": reset_token, "new_password": "123"}
        assert post(client, "/api/auth/password-reset/confirm", weak, token).status_code == 400

        new_password = "una-clave-nueva-larga"
        ok = {"uid": uid, "token": reset_token, "new_password": new_password}
        assert post(client, "/api/auth/password-reset/confirm", ok, token).status_code == 204
        user_a.refresh_from_db()
        assert user_a.check_password(new_password)
        # El token queda invalidado al cambiar la contraseña.
        assert post(client, "/api/auth/password-reset/confirm", ok, token).status_code == 400

    def test_bad_uid_is_400(self):
        client, token = csrf_client()
        data = {"uid": "basura", "token": "x", "new_password": "una-clave-nueva-larga"}
        assert post(client, "/api/auth/password-reset/confirm", data, token).status_code == 400


@pytest.mark.django_db
def test_membership_changes_are_audited(user_a, org_a, org_b, platform_admin):
    assert AuditLog.objects.filter(action="access.granted", organization=org_a, target_id=str(user_a.pk)).exists()
    membership = Membership.objects.create(user=user_a, organization=org_b)
    membership.role = Membership.Role.ORG_ADMIN
    membership.save()
    membership.delete()
    actions = list(AuditLog.objects.filter(organization=org_b).order_by("id").values_list("action", flat=True))
    assert actions == ["access.granted", "access.changed", "access.revoked"]
