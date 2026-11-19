"""Configuración para pytest.

Las pruebas no dependen de backend/.env: usan SQLite en memoria salvo que se
defina HAIL_TEST_DATABASE_URL (CI la define para probar contra PostgreSQL +
TimescaleDB).
"""
import environ

from .base import *  # noqa: F403

_test_db = environ.Env().str("HAIL_TEST_DATABASE_URL", default="")
DATABASES = {
    "default": environ.Env.db_url_config(_test_db)
    if _test_db
    else {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
FRONTEND_URL = "https://hail.test"
