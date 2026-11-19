"""Genera los archivos passwd y acl de Mosquitto desde la base de datos.

    python manage.py mqtt_sync_auth
    docker compose -f infra/compose.yaml kill -s SIGHUP mqtt    # el broker relee los archivos

Ejecútalo cada vez que cambies credenciales MQTT o actives/desactives dispositivos.
"""

import os
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.telemetry.broker_auth import build_broker_files


def write_atomic(path: Path, content: str) -> None:
    """Escribe en un temporal y reemplaza, para que el broker nunca lea un archivo a medias."""
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False, newline="\n") as tmp:
        tmp.write(content)
    os.replace(tmp.name, path)


class Command(BaseCommand):
    help = "Genera passwd y acl de Mosquitto: cada dispositivo publica solo en su tópico."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output", default=str(settings.MQTT_AUTH_DIR), help="Carpeta de configuración del broker."
        )

    def handle(self, *args, **options):
        output = Path(options["output"])
        if not output.is_dir():
            raise CommandError(f"No existe la carpeta {output}")
        try:
            files = build_broker_files()
        except ValueError as error:
            raise CommandError(str(error)) from error
        if not files.accounts:
            raise CommandError(
                "No hay cuentas que escribir. Define HAIL_MQTT_USERNAME y HAIL_MQTT_PASSWORD en backend/.env "
                "(cuenta del worker de ingesta)."
            )
        write_atomic(output / "passwd", files.passwd)
        write_atomic(output / "acl", files.acl)
        for account in files.accounts:
            self.stdout.write(f"  {account.username:<24} {account.access:<5} {account.topic}")
        for topic in files.skipped:
            self.stdout.write(self.style.WARNING(f"  sin credencial, no podrá publicar: {topic}"))
        self.stdout.write(self.style.SUCCESS(f"Escrito en {output}. Recarga el broker para aplicar:"))
        self.stdout.write("  docker compose -f infra/compose.yaml kill -s SIGHUP mqtt")
