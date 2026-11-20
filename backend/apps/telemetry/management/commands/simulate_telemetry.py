"""Publica telemetría simulada de AguaPozo y de los medidores eléctricos.

    python manage.py simulate_telemetry --direct     # sin broker: escribe directo en la base
    python manage.py simulate_telemetry              # publica en el broker MQTT (requiere ingest_mqtt)

Opciones: --interval segundos entre muestras (10), --count cantidad de ciclos (0 = sin fin),
--fault pump|dosing para provocar una falla de AguaPozo al partir (y ver sus alarmas),
--no-faults para no simular fallas al azar. Todos los datos llevan calidad "simulated".
"""

import random
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.telemetry.mqtt import build_client
from apps.telemetry.services import IngestError, ingest
from apps.telemetry.simulator import FAULTS, AguaPozoSimulator, default_meters


class Command(BaseCommand):
    help = "Genera telemetría simulada (AguaPozo y medidores 1 a 3)."

    def add_arguments(self, parser):
        parser.add_argument("--direct", action="store_true", help="Escribe directo en la base, sin broker MQTT.")
        parser.add_argument("--interval", type=float, default=10.0, help="Segundos entre muestras (10).")
        parser.add_argument("--count", type=int, default=0, help="Ciclos a generar; 0 = sin fin.")
        parser.add_argument("--seed", type=int, default=None, help="Semilla aleatoria, para resultados repetibles.")
        parser.add_argument("--fault", choices=FAULTS, help="Provoca esta falla de AguaPozo al partir.")
        parser.add_argument("--no-faults", action="store_true", help="No simula fallas al azar.")

    def handle(self, *args, **options):
        rng = random.Random(options["seed"])
        aguapozo = AguaPozoSimulator(rng=rng)
        if options["no_faults"]:
            aguapozo.fault_probability = 0
        if options["fault"]:
            aguapozo.start_fault(options["fault"])
        meters = default_meters(rng)
        interval = options["interval"]

        client = None
        if not options["direct"]:
            client, host, port = build_client(
                "hail-simulator",
                username=settings.MQTT_SIMULATOR_USERNAME if settings.MQTT_SIMULATOR_PASSWORD else "",
                password=settings.MQTT_SIMULATOR_PASSWORD,
            )
            try:
                client.connect(host, port, keepalive=30)
            except OSError as error:
                raise CommandError(
                    f"No hay broker en {host}:{port} ({error}). Levántalo con Docker o usa --direct."
                ) from error
            client.loop_start()

        def send(topic: str, payload: bytes) -> None:
            if client is not None:
                client.publish(topic, payload, qos=1)
                return
            try:
                ingest(topic, payload)
            except IngestError as error:
                raise CommandError(f"{error}. ¿Corriste 'python manage.py seed_demo'?") from error

        mode = "directo a la base" if client is None else "por MQTT"
        self.stdout.write(f"Simulando cada {interval:g} s ({mode}). Ctrl+C para detener.")
        cycle = 0
        try:
            while options["count"] == 0 or cycle < options["count"]:
                now = timezone.now()
                send(aguapozo.topic, aguapozo.next_payload(now))
                for meter in meters:
                    send(meter.topic, meter.next_payload(now, interval))
                cycle += 1
                fault = f" · falla simulada: {aguapozo.fault}" if aguapozo.fault else ""
                self.stdout.write(f"{now:%H:%M:%S} ciclo {cycle}: AguaPozo + {len(meters)} medidores{fault}")
                if options["count"] == 0 or cycle < options["count"]:
                    time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("Detenido.")
        finally:
            if client is not None:
                client.loop_stop()
                client.disconnect()
