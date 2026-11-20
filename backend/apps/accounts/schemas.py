from ninja import Schema
from pydantic import Field

# El correo de login y de recuperación no se valida como dirección entregable:
# basta con buscar la cuenta. EmailStr rechaza dominios reservados como
# `.local`, que usan las cuentas de desarrollo (cliente-aguapozo@hail.local).
Email = Field(min_length=3, max_length=254)


class LoginIn(Schema):
    email: str = Email
    password: str = Field(max_length=4096)


class PasswordResetIn(Schema):
    email: str = Email


class PasswordResetConfirmIn(Schema):
    uid: str
    token: str
    new_password: str


class OrganizationRoleOut(Schema):
    slug: str
    name: str
    role: str


class MeOut(Schema):
    id: int
    email: str
    full_name: str
    is_platform_admin: bool
    organizations: list[OrganizationRoleOut]


class CsrfOut(Schema):
    csrf_token: str


class MessageOut(Schema):
    detail: str
