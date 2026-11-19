"""Auditoría automática de inicios de sesión y cambios de acceso."""

from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.tenancy.models import Membership

from .services import record


@receiver(user_logged_in)
def on_login(sender, request, user, **kwargs):
    record("auth.login", actor=user, target=user)


@receiver(user_logged_out)
def on_logout(sender, request, user, **kwargs):
    if user is not None:
        record("auth.logout", actor=user, target=user)


@receiver(user_login_failed)
def on_login_failed(sender, credentials, request=None, **kwargs):
    # Solo se guarda el correo intentado, nunca la contraseña.
    record("auth.login_failed", email=str(credentials.get("email") or credentials.get("username") or ""))


@receiver(post_save, sender=Membership)
def on_membership_saved(sender, instance, created, **kwargs):
    record(
        "access.granted" if created else "access.changed",
        organization=instance.organization,
        target=instance.user,
        role=instance.role,
    )


@receiver(post_delete, sender=Membership)
def on_membership_deleted(sender, instance, **kwargs):
    record("access.revoked", organization=instance.organization, target=instance.user, role=instance.role)
