"""Revisa las alarmas de comunicación (dispositivos sin enviar datos).

    python manage.py check_alarms           # una vez
    python manage.py check_alarms --loop    # cada 15 s, hasta Ctrl+C

El worker de ingesta y el simulador en modo directo ya hacen esta revisión;
este comando sirve cuando ninguno de los dos está corriendo, o desde cron.
"""

import time

from django.core.management.base import BaseCommand
from django.db import DatabaseError, close_old_connections

from apps.alarms.services import check_communication_and_notify

INTERVAL_SECONDS = 15


class Command(BaseCommand):
    help = "Activa o normaliza alarmas de pérdida de comunicación."

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true", help=f"Repite cada {INTERVAL_SECONDS} s.")

    def handle(self, *args, **options):
        while True:
            close_old_connections()
            try:
                result = check_communication_and_notify()
                self.stdout.write(f"Comunicación revisada: {len(result.raised)} nuevas, {result.cleared} normalizadas.")
            except DatabaseError as error:
                self.stderr.write(f"Base de datos no disponible: {str(error).splitlines()[0]}")
            if not options["loop"]:
                return
            try:
                time.sleep(INTERVAL_SECONDS)
            except KeyboardInterrupt:
                self.stdout.write("Detenido.")
                return
