"""Credenciales y permisos del broker Mosquitto generados desde la base de datos.

Mosquitto lee un archivo de contraseñas (`passwd`) y uno de permisos (`acl`).
`manage.py mqtt_sync_auth` los genera a partir de los dispositivos activos:

- cada dispositivo con usuario y contraseña MQTT puede **publicar solo en su tópico**;
- la cuenta de ingesta puede **leer** hail/+/+/+/telemetry;
- la cuenta del simulador (solo si se configura) puede publicar en cualquier tópico de telemetría.

El hash es el formato `$7$` de mosquitto_passwd 2.x (PBKDF2-SHA512), así la
contraseña en claro nunca se guarda.
"""

import base64
import hashlib
import secrets
from dataclasses import dataclass

from django.conf import settings

from apps.projects.models import Device

MOSQUITTO_ITERATIONS = 20_000
TELEMETRY_TOPICS = "hail/+/+/+/telemetry"


def mosquitto_hash(password: str, *, iterations: int = MOSQUITTO_ITERATIONS, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(12)
    digest = hashlib.pbkdf2_hmac("sha512", password.encode(), salt, iterations, 64)
    return f"$7${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def is_mosquitto_hash(value: str) -> bool:
    return value.startswith("$7$") and value.count("$") == 4


@dataclass
class BrokerAccount:
    username: str
    password_hash: str
    access: str  # "read" o "write"
    topic: str


@dataclass
class BrokerFiles:
    passwd: str
    acl: str
    accounts: list[BrokerAccount]
    skipped: list[str]  # dispositivos activos sin credencial


def service_accounts() -> list[BrokerAccount]:
    accounts = []
    if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
        accounts.append(
            BrokerAccount(settings.MQTT_USERNAME, mosquitto_hash(settings.MQTT_PASSWORD), "read", TELEMETRY_TOPICS)
        )
    if settings.MQTT_SIMULATOR_USERNAME and settings.MQTT_SIMULATOR_PASSWORD:
        accounts.append(
            BrokerAccount(
                settings.MQTT_SIMULATOR_USERNAME,
                mosquitto_hash(settings.MQTT_SIMULATOR_PASSWORD),
                "write",
                TELEMETRY_TOPICS,
            )
        )
    return accounts


def build_broker_files() -> BrokerFiles:
    accounts = service_accounts()
    reserved = {account.username for account in accounts}
    skipped = []
    devices = Device.objects.filter(
        is_active=True, project__is_active=True, project__organization__is_active=True
    ).select_related("project__organization")
    for device in devices.order_by("project__organization__slug", "project__slug", "code"):
        if not device.mqtt_username or not is_mosquitto_hash(device.mqtt_password_hash):
            skipped.append(device.telemetry_topic)
            continue
        if device.mqtt_username in reserved:
            raise ValueError(f"El usuario MQTT {device.mqtt_username} está reservado para una cuenta de servicio")
        accounts.append(BrokerAccount(device.mqtt_username, device.mqtt_password_hash, "write", device.telemetry_topic))

    passwd = "".join(f"{a.username}:{a.password_hash}\n" for a in accounts)
    header = "# Generado por manage.py mqtt_sync_auth. No editar a mano.\n\n"
    acl = header + "\n".join(f"user {a.username}\ntopic {a.access} {a.topic}\n" for a in accounts)
    return BrokerFiles(passwd=passwd, acl=acl, accounts=accounts, skipped=skipped)
