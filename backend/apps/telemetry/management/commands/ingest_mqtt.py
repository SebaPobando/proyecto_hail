"""Worker de ingesta: escucha el broker MQTT y guarda las lecturas.

    python manage.py ingest_mqtt

Proceso de larga duración. Se reconecta solo si el broker se cae y deja su
pulso en WorkerStatus cada HEARTBEAT_SECONDS para la pantalla Conectividad.
"""

import logging
import threading
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import DatabaseError, close_old_connections
from django.utils import timezone

from apps.telemetry.models import WorkerStatus
from apps.telemetry.mqtt import TELEMETRY_SUBSCRIPTION, build_client
from apps.telemetry.services import IngestError, ingest

logger = logging.getLogger("apps.telemetry.ingest")

WORKER_NAME = "ingest"
HEARTBEAT_SECONDS = 15


def handle_message(topic: str, payload: bytes) -> bool:
    """Procesa un mensaje y dice si fue aceptado. Nunca lanza: un mensaje malo no detiene el worker."""
    close_old_connections()  # conexiones a la base de un proceso que vive mucho tiempo
    try:
        result = ingest(topic, payload)
    except IngestError as error:
        logger.warning("Mensaje rechazado en %s: %s", topic, error)
        return False
    except Exception:
        logger.exception("Error inesperado procesando %s", topic)
        return False
    logger.debug("%s: %s valores guardados", topic, result.accepted)
    return True


class Counters:
    """Contadores compartidos entre el hilo de MQTT y el del pulso."""

    def __init__(self):
        self.lock = threading.Lock()
        self.accepted = 0
        self.rejected = 0
        self.last_message_at = None
        self.connected = False

    def record(self, accepted: bool) -> None:
        with self.lock:
            if accepted:
                self.accepted += 1
            else:
                self.rejected += 1
            self.last_message_at = timezone.now()


def write_heartbeat(started_at, counters: Counters) -> bool:
    """Guarda el pulso. Si la base no responde, avisa y devuelve False: el worker sigue vivo y reintenta."""
    try:
        close_old_connections()
        _save_heartbeat(started_at, counters)
    except DatabaseError as error:
        logger.error("No se pudo escribir el pulso en la base de datos: %s", str(error).splitlines()[0])
        return False
    return True


def _save_heartbeat(started_at, counters: Counters) -> None:
    with counters.lock:
        values = {
            "started_at": started_at,
            "last_heartbeat": timezone.now(),
            "broker_connected": counters.connected,
            "last_message_at": counters.last_message_at,
            "messages_accepted": counters.accepted,
            "messages_rejected": counters.rejected,
        }
    WorkerStatus.objects.update_or_create(name=WORKER_NAME, defaults=values)


class Command(BaseCommand):
    help = "Escucha hail/+/+/+/telemetry en el broker MQTT y guarda las lecturas."

    def handle(self, *args, **options):
        client, host, port = build_client(
            "hail-ingest", username=settings.MQTT_USERNAME, password=settings.MQTT_PASSWORD
        )
        counters = Counters()
        started_at = timezone.now()

        def on_connect(client, userdata, flags, reason_code, properties):
            if reason_code.is_failure:
                logger.error("El broker rechazó la conexión: %s", reason_code)
                return
            counters.connected = True
            client.subscribe(TELEMETRY_SUBSCRIPTION, qos=1)
            self.stdout.write(self.style.SUCCESS(f"Conectado a {host}:{port}, escuchando {TELEMETRY_SUBSCRIPTION}"))

        def on_disconnect(client, userdata, flags, reason_code, properties):
            counters.connected = False
            logger.warning("Desconectado del broker (%s); reintentando…", reason_code)

        def on_message(client, userdata, message):
            counters.record(handle_message(message.topic, message.payload))

        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_message = on_message
        client.reconnect_delay_set(min_delay=1, max_delay=30)
        client.connect_async(host, port, keepalive=30)
        client.loop_start()
        try:
            while True:
                write_heartbeat(started_at, counters)
                time.sleep(HEARTBEAT_SECONDS)
        except KeyboardInterrupt:
            self.stdout.write("Detenido.")
        finally:
            client.loop_stop()
            counters.connected = False
            write_heartbeat(started_at, counters)
