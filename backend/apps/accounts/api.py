"""Autenticación por sesión: CSRF, login, logout, perfil y recuperación de contraseña."""

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.middleware.csrf import get_token
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from ninja import Router, Status
from ninja.decorators import decorate_view

from apps.audit.services import record
from apps.tenancy.models import Membership

from .models import User
from .schemas import (
    CsrfOut,
    LoginIn,
    MeOut,
    MessageOut,
    PasswordResetConfirmIn,
    PasswordResetIn,
)

router = Router()


def serialize_me(user: User) -> dict:
    memberships = (
        Membership.objects.filter(user=user, organization__is_active=True)
        .select_related("organization")
        .order_by("organization__name")
    )
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.get_full_name(),
        "is_platform_admin": user.is_platform_admin,
        "organizations": [
            {"slug": m.organization.slug, "name": m.organization.name, "role": m.role} for m in memberships
        ],
    }


@router.get("/csrf", auth=None, response=CsrfOut)
@decorate_view(ensure_csrf_cookie)
def csrf(request):
    """Entrega la cookie y el token CSRF. El frontend lo llama al iniciar."""
    return {"csrf_token": get_token(request)}


@router.post("/login", auth=None, response={200: MeOut, 401: MessageOut})
@decorate_view(csrf_protect)
def login_view(request, payload: LoginIn):
    user = authenticate(request, email=payload.email.lower(), password=payload.password)
    if user is None:
        return Status(401, {"detail": "Correo o contraseña incorrectos."})
    login(request, user)
    return Status(200, serialize_me(user))


@router.post("/logout", response={204: None})
def logout_view(request):
    logout(request)
    return Status(204, None)


@router.get("/me", response=MeOut)
def me(request):
    return serialize_me(request.user)


@router.post("/password-reset", auth=None, response={202: MessageOut})
@decorate_view(csrf_protect)
def password_reset(request, payload: PasswordResetIn):
    """Envía el enlace de recuperación. Responde igual exista o no la cuenta."""
    user = User.objects.filter(email__iexact=payload.email, is_active=True).first()
    if user and user.has_usable_password():
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        context = {
            "user": user,
            "reset_url": f"{settings.FRONTEND_URL}/#reset?uid={uid}&token={token}",
        }
        send_mail(
            subject="Hail · Recupera tu contraseña",
            message=render_to_string("emails/password_reset.txt", context),
            from_email=None,
            recipient_list=[user.email],
        )
        record("auth.password_reset_requested", target=user)
    return Status(202, {"detail": "Si la cuenta existe, enviamos un correo con instrucciones."})


@router.post("/password-reset/confirm", auth=None, response={204: None, 400: MessageOut})
@decorate_view(csrf_protect)
def password_reset_confirm(request, payload: PasswordResetConfirmIn):
    invalid = Status(400, {"detail": "El enlace no es válido o ya expiró."})
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(payload.uid)), is_active=True)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return invalid
    if not default_token_generator.check_token(user, payload.token):
        return invalid
    try:
        validate_password(payload.new_password, user)
    except ValidationError as error:
        return Status(400, {"detail": " ".join(error.messages)})
    user.set_password(payload.new_password)
    user.save(update_fields=["password"])
    record("auth.password_reset_completed", actor=user, target=user)
    return Status(204, None)
