from ninja import Schema
from pydantic import EmailStr


class LoginIn(Schema):
    email: EmailStr
    password: str


class PasswordResetIn(Schema):
    email: EmailStr


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
