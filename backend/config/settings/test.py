"""Configuración para pytest.

Usa SQLite en memoria salvo que se defina DATABASE_URL (CI usa PostgreSQL +
TimescaleDB para probar contra el motor real).
"""

import os

from .base import *  # noqa: F403

if "DATABASE_URL" not in os.environ:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
FRONTEND_URL = "https://hail.test"
