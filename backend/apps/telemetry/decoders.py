"""Decodificadores de mensajes de campo.

Cada dispositivo declara su decodificador (`Device.decoder`). Un decodificador
recibe el payload crudo y devuelve un `Sample` con la fecha de adquisición y
los valores por tag. No valida rangos ni pertenencia: eso lo hace el servicio
de ingesta con el catálogo de señales.

Formatos documentados en docs/PROTOCOLO_MQTT.md.
"""

import json
import math
from dataclasses import dataclass, field
from datetime import datetime

from .models import Quality


class DecodeError(ValueError):
    """El payload no cumple el formato declarado."""


@dataclass
class Sample:
    time: datetime
    values: dict[str, tuple[float, str]] = field(default_factory=dict)  # tag -> (valor, calidad)


def _json(payload: bytes) -> dict:
    try:
        data = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DecodeError("El payload no es JSON válido") from error
    if not isinstance(data, dict):
        raise DecodeError("El payload debe ser un objeto JSON")
    return data


def _timestamp(raw) -> datetime:
    if not isinstance(raw, str):
        raise DecodeError("Falta la fecha de adquisición (ISO 8601)")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as error:
        raise DecodeError("Fecha de adquisición inválida") from error
    if parsed.tzinfo is None:
        raise DecodeError("La fecha de adquisición debe incluir zona horaria")
    return parsed


def _number(raw, name: str) -> float:
    if isinstance(raw, bool) or not isinstance(raw, int | float) or not math.isfinite(raw):
        raise DecodeError(f"Valor no numérico en {name}")
    return float(raw)


QUALITIES = {q.value for q in Quality}


def decode_hail_v1(payload: bytes) -> Sample:
    """Formato genérico de Hail.

    {"v": 1, "ts": "2026-11-19T20:00:00Z", "quality": "good",
     "values": {"MED-01-VAN": 231.4, "MED-01-F": {"value": 50.01, "quality": "uncertain"}}}
    """
    data = _json(payload)
    if data.get("v") != 1:
        raise DecodeError("Versión de formato no soportada (se espera v=1)")
    default_quality = data.get("quality", Quality.GOOD)
    if default_quality not in QUALITIES:
        raise DecodeError("Calidad desconocida")
    values = data.get("values")
    if not isinstance(values, dict) or not values:
        raise DecodeError("'values' debe ser un objeto con al menos un tag")
    sample = Sample(time=_timestamp(data.get("ts")))
    for tag, raw in values.items():
        quality = default_quality
        if isinstance(raw, dict):
            quality = raw.get("quality", default_quality)
            if quality not in QUALITIES:
                raise DecodeError(f"Calidad desconocida en {tag}")
            raw = raw.get("value")
        sample.values[str(tag)] = (_number(raw, tag), quality)
    return sample


# Mensaje de prueba heredado del prototipo (lo usa el simulador). Siempre calidad simulada:
# nunca debe aparentar una conexión real.
TEST_V1_MEASUREMENTS = {"level": "LT-101", "wellWaterDepthM": "LT-102", "flow": "FT-101", "chlorine": "AIT-101"}
TEST_V1_STATES = {
    "pump": ("P-101", {"stopped": 0, "running": 1, "fault": 2}),
    "dosing": ("D-101", {"inactive": 0, "active": 1, "fault": 2}),
}


def decode_test_v1(payload: bytes) -> Sample:
    data = _json(payload)
    if data.get("version") != 1:
        raise DecodeError("Formato de prueba inválido (se espera version=1)")
    sample = Sample(time=_timestamp(data.get("timestamp")))
    for key, tag in TEST_V1_MEASUREMENTS.items():
        sample.values[tag] = (_number(data.get(key), key), Quality.SIMULATED)
    for key, (tag, codes) in TEST_V1_STATES.items():
        if data.get(key) not in codes:
            raise DecodeError(f"Estado inválido en {key}")
        sample.values[tag] = (float(codes[data[key]]), Quality.SIMULATED)
    return sample


DECODERS = {
    "hail_v1": decode_hail_v1,
    "test_v1": decode_test_v1,
}
