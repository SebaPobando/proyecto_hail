"""Generadores de mensajes simulados para desarrollo y demostraciones.

Todos los valores llevan calidad `simulated`. Los rangos replican el
simulador del prototipo (frontend/src/services/simulation.ts) y los datos de
ejemplo de los medidores.
"""

import json
import random
from dataclasses import dataclass, field
from datetime import datetime

from .models import Quality


def _walk(value: float, low: float, high: float, step: float, rng: random.Random) -> float:
    """Paso aleatorio suave y acotado."""
    return min(high, max(low, value + rng.uniform(-step, step)))


@dataclass
class AguaPozoSimulator:
    """Mensaje test_v1 del gateway de AguaPozo (cbox-01)."""

    topic: str = "hail/aguapozo/aguapozo/cbox-01/telemetry"
    level: float = 68.0
    well: float = 12.0
    flow: float = 12.4
    chlorine: float = 0.65
    rng: random.Random = field(default_factory=random.Random)

    def next_payload(self, now: datetime) -> bytes:
        rng = self.rng
        self.level = _walk(self.level, 65, 71, 0.3, rng)
        self.well = _walk(self.well, 11, 13, 0.05, rng)
        self.flow = _walk(self.flow, 11.8, 13.0, 0.1, rng)
        self.chlorine = _walk(self.chlorine, 0.625, 0.675, 0.004, rng)
        message = {
            "version": 1,
            "timestamp": now.isoformat(),
            "level": round(self.level, 2),
            "wellWaterDepthM": round(self.well, 2),
            "flow": round(self.flow, 2),
            "chlorine": round(self.chlorine, 3),
            "pump": "running",
            "dosing": "active",
        }
        return json.dumps(message).encode()


@dataclass
class MeterSimulator:
    """Mensaje hail_v1 de un medidor eléctrico trifásico."""

    code: str  # ej. "MED-01"
    load_kw: float
    energy_kwh: float
    rng: random.Random = field(default_factory=random.Random)

    @property
    def topic(self) -> str:
        return f"hail/ulagos/medidores-electricos/{self.code.lower()}/telemetry"

    def next_payload(self, now: datetime, interval_s: float) -> bytes:
        rng = self.rng
        van = rng.uniform(229.5, 234.0)
        power = max(0.0, self.load_kw * rng.uniform(0.85, 1.15))
        pf = rng.uniform(0.88, 0.96) if power else 0.0
        current = power * 1000 / (3 * van * pf) if power else 0.0
        self.energy_kwh += power * interval_s / 3600
        values = {
            "VAN": van,
            "VAB": van * 3**0.5,
            "IA": current,
            "P": power,
            "FP": pf,
            "F": rng.uniform(49.9, 50.05),
            "THDV": rng.uniform(1.5, 3.0),
            "E": self.energy_kwh,
        }
        message = {
            "v": 1,
            "ts": now.isoformat(),
            "quality": Quality.SIMULATED,
            "values": {f"{self.code}-{key}": round(value, 3) for key, value in values.items()},
        }
        return json.dumps(message).encode()


def default_meters(rng: random.Random) -> list[MeterSimulator]:
    """Medidores 1 a 3 en línea. 4 y 5 quedan sin comunicación, como en la demo del prototipo."""
    return [
        MeterSimulator("MED-01", load_kw=6.2, energy_kwh=1349.7, rng=rng),
        MeterSimulator("MED-02", load_kw=0.0, energy_kwh=3911.4, rng=rng),
        MeterSimulator("MED-03", load_kw=0.0, energy_kwh=0.0, rng=rng),
    ]
