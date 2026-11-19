"""Convierte telemetry_reading en hypertable de TimescaleDB.

Solo actúa en PostgreSQL con la extensión timescaledb disponible (la imagen
de infra/compose.yaml y CI la traen). En SQLite o en un PostgreSQL sin
Timescale no hace nada: la tabla sigue funcionando como tabla normal.
"""
from django.db import migrations


def timescale_available(schema_editor) -> bool:
    if schema_editor.connection.vendor != "postgresql":
        return False
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb'")
        return cursor.fetchone() is not None


def create_hypertable(apps, schema_editor):
    if not timescale_available(schema_editor):
        return
    schema_editor.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
    schema_editor.execute(
        "SELECT create_hypertable('telemetry_reading', by_range('time', INTERVAL '7 days'), "
        "if_not_exists => TRUE, migrate_data => TRUE)"
    )


class Migration(migrations.Migration):
    dependencies = [("telemetry", "0001_initial")]

    operations = [migrations.RunPython(create_hypertable, migrations.RunPython.noop)]
