"""Worker de ingesta: escucha el broker MQTT y guarda las lecturas.

    python manage.py ingest_mqtt

Proceso de larga duración. Se reconecta solo si el broker se cae.
"""

import logging

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from apps.telemetry.mqtt import TELEMETRY_SUBSCRIPTION, build_client
from apps.telemetry.services import IngestError, ingest

logger = logging.getLogger("apps.telemetry.ingest")


def handle_message(topic: str, payload: bytes) -> None:
    """Procesa un mensaje. Nunca lanza: un mensaje malo no debe detener el worker."""
    close_old_connections()  # conexiones a la base de un proceso que vive mucho tiempo
    try:
        result = ingest(topic, payload)
    except IngestError as error:
        logger.warning("Mensaje rechazado en %s: %s", topic, error)
    except Exception:
        logger.exception("Error inesperado procesando %s", topic)
    else:
        logger.debug("%s: %s valores guardados", topic, result.accepted)


class Command(BaseCommand):
    help = "Escucha hail/+/+/+/telemetry en el broker MQTT y guarda las lecturas."

    def handle(self, *args, **options):
        client, host, port = build_client("hail-ingest")

        def on_connect(client, userdata, flags, reason_code, properties):
            if reason_code.is_failure:
                logger.error("El broker rechazó la conexión: %s", reason_code)
                return
            client.subscribe(TELEMETRY_SUBSCRIPTION, qos=1)
            self.stdout.write(self.style.SUCCESS(f"Conectado a {host}:{port}, escuchando {TELEMETRY_SUBSCRIPTION}"))

        def on_disconnect(client, userdata, flags, reason_code, properties):
            logger.warning("Desconectado del broker (%s); reintentando…", reason_code)

        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_message = lambda client, userdata, message: handle_message(message.topic, message.payload)
        client.reconnect_delay_set(min_delay=1, max_delay=30)
        client.connect_async(host, port, keepalive=30)
        try:
            client.loop_forever(retry_first_connection=True)
        except KeyboardInterrupt:
            self.stdout.write("Detenido.")
