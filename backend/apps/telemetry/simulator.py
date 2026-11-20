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


def _recover(value: float, low: float, high: float, step: float, rng: random.Random, rate: float) -> float:
    """Vuelve gradualmente a la banda normal tras una falla y luego camina dentro de ella."""
    if value < low:
        return min(low, value + rate)
    if value > high:
        return max(high, value - rate)
    return _walk(value, low, high, step, rng)


FAULTS = ("pump", "dosing")


@dataclass
class AguaPozoSimulator:
    """Mensaje test_v1 del gateway de AguaPozo (cbox-01).

    De vez en cuando simula una falla, para que la demostración tenga alarmas:
    - "pump": la bomba queda en falla, el caudal cae a 0 y el estanque baja.
    - "dosing": la dosificación falla y el cloro residual cae bajo 0,2 mg/L.
    Cada falla dura entre 15 y 30 muestras y luego el proceso se recupera solo.
    """

    topic: str = "hail/aguapozo/aguapozo/cbox-01/telemetry"
    level: float = 68.0
    well: float = 12.0
    flow: float = 12.4
    chlorine: float = 0.65
    rng: random.Random = field(default_factory=random.Random)
    # Probabilidad de iniciar una falla en cada muestra: con muestras cada 10 s, ~1 falla cada 30 min.
    fault_probability: float = 1 / 180
    fault: str | None = None
    fault_left: int = 0

    def start_fault(self, kind: str, samples: int | None = None) -> None:
        if kind not in FAULTS:
            raise ValueError(f"Falla desconocida: {kind}")
        self.fault = kind
        self.fault_left = samples if samples is not None else self.rng.randint(15, 30)

    def next_payload(self, now: datetime) -> bytes:
        rng = self.rng
        if self.fault is None and self.fault_probability and rng.random() < self.fault_probability:
            self.start_fault(rng.choice(FAULTS))
        pump, dosing = "running", "active"
        if self.fault == "pump":
            pump = "fault"
            self.flow = max(0.0, self.flow - 4.0)
            self.level = max(0.0, self.level - 0.4)
        else:
            self.flow = _recover(self.flow, 11.8, 13.0, 0.1, rng, rate=3.0)
            self.level = _recover(self.level, 65, 71, 0.3, rng, rate=0.4)
        if self.fault == "dosing":
            dosing = "fault"
            self.chlorine = max(0.1, self.chlorine - 0.04)
        else:
            self.chlorine = _recover(self.chlorine, 0.625, 0.675, 0.004, rng, rate=0.03)
        self.well = _walk(self.well, 11, 13, 0.05, rng)
        if self.fault is not None:
            self.fault_left -= 1
            if self.fault_left <= 0:
                self.fault = None
        message = {
            "version": 1,
            "timestamp": now.isoformat(),
            "level": round(self.level, 2),
            "wellWaterDepthM": round(self.well, 2),
            "flow": round(self.flow, 2),
            "chlorine": round(self.chlorine, 3),
            "pump": pump,
            "dosing": dosing,
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
