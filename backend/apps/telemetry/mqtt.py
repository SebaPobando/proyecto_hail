"""Cliente MQTT compartido por el worker de ingesta y el simulador."""

from urllib.parse import urlparse

import paho.mqtt.client as mqtt
from django.conf import settings

TELEMETRY_SUBSCRIPTION = "hail/+/+/+/telemetry"


def build_client(client_id: str, *, username: str = "", password: str = "") -> tuple[mqtt.Client, str, int]:
    """Crea un cliente para HAIL_MQTT_URL (mqtt:// o mqtts:// para TLS).

    Cada proceso pasa sus propias credenciales: el worker usa la cuenta de ingesta
    (solo lectura) y el simulador la suya (solo escritura).
    """
    url = urlparse(settings.MQTT_URL)
    if url.scheme not in ("mqtt", "mqtts"):
        raise ValueError("HAIL_MQTT_URL debe empezar con mqtt:// o mqtts://")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    if username:
        client.username_pw_set(username, password)
    if url.scheme == "mqtts":
        client.tls_set()
    port = url.port or (8883 if url.scheme == "mqtts" else 1883)
    return client, url.hostname or "localhost", port
