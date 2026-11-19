"""Configuración común a todos los entornos.

Los valores sensibles o que cambian por entorno se leen desde variables de
entorno (o desde backend/.env en desarrollo). Ver backend/.env.example.
"""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env", overwrite=False)

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-inseguro-no-usar-en-produccion")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CSRF_TRUSTED_ORIGINS = env.list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Apps de Hail
    "apps.accounts",
    "apps.tenancy",
    "apps.projects",
    "apps.audit",
    "apps.telemetry",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.audit.middleware.CurrentActorMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://hail:hail@127.0.0.1:5433/hail"),
}
# Reutiliza conexiones (el worker de ingesta vive mucho tiempo) y verifica que sigan vivas.
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DJANGO_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-cl"
TIME_ZONE = "America/Santiago"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Sesión por cookie en el mismo dominio que el frontend (Caddy en producción,
# proxy de Vite en desarrollo). El frontend lee la cookie CSRF para enviarla
# en el encabezado X-CSRFToken.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 12
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"

EMAIL_BACKEND = env("DJANGO_EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = env("DJANGO_DEFAULT_FROM_EMAIL", default="Hail <no-responder@hail.local>")

# URL pública del frontend; se usa en los enlaces de los correos.
FRONTEND_URL = env("HAIL_FRONTEND_URL", default="http://localhost:5173")

# Telemetría
MQTT_URL = env("HAIL_MQTT_URL", default="mqtt://127.0.0.1:1883")
MQTT_USERNAME = env("HAIL_MQTT_USERNAME", default="")
MQTT_PASSWORD = env("HAIL_MQTT_PASSWORD", default="")
# Cuenta del simulador (solo desarrollo). Sin contraseña, no se crea en el broker.
MQTT_SIMULATOR_USERNAME = env("HAIL_MQTT_SIMULATOR_USERNAME", default="hail-simulator")
MQTT_SIMULATOR_PASSWORD = env("HAIL_MQTT_SIMULATOR_PASSWORD", default="")
# Carpeta donde mqtt_sync_auth escribe passwd y acl (montada en el contenedor de Mosquitto).
MQTT_AUTH_DIR = Path(env("HAIL_MQTT_AUTH_DIR", default=str(BASE_DIR.parent / "infra" / "mosquitto" / "config")))
# Segundos sin mensajes tras los cuales un dispositivo o el worker se consideran fuera de línea.
TELEMETRY_OFFLINE_SECONDS = env.int("HAIL_TELEMETRY_OFFLINE_SECONDS", default=60)
# Segundos sin datos tras los cuales una lectura se informa como vencida.
TELEMETRY_STALE_SECONDS = env.int("HAIL_TELEMETRY_STALE_SECONDS", default=30)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": env("DJANGO_LOG_LEVEL", default="INFO")},
}
