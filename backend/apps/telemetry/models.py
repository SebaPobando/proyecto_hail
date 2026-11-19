"""Lecturas de campo.

`Reading` es la serie histórica (en PostgreSQL con TimescaleDB es una
hypertable particionada por tiempo). Su clave primaria es (señal, tiempo):
un mismo instante de una señal solo se guarda una vez, así los mensajes
duplicados se descartan solos.

`LatestReading` guarda el último valor de cada señal para leer el estado
actual sin recorrer el historial.
"""

from django.db import models

from apps.projects.models import Signal


class Quality(models.TextChoices):
    GOOD = "good", "Válida"
    UNCERTAIN = "uncertain", "Dudosa"
    BAD = "bad", "Mala"
    SIMULATED = "simulated", "Simulada"


class Reading(models.Model):
    pk = models.CompositePrimaryKey("signal", "time")
    signal = models.ForeignKey(Signal, on_delete=models.CASCADE, related_name="readings", verbose_name="señal")
    time = models.DateTimeField("fecha de adquisición")
    value = models.FloatField("valor")
    quality = models.CharField("calidad", max_length=12, choices=Quality.choices)

    class Meta:
        verbose_name = "lectura"
        verbose_name_plural = "lecturas"
        indexes = [models.Index(fields=["signal", "-time"], name="reading_signal_time_desc")]

    def __str__(self) -> str:
        return f"{self.signal_id} @ {self.time:%Y-%m-%d %H:%M:%S} = {self.value}"


class LatestReading(models.Model):
    signal = models.OneToOneField(
        Signal, on_delete=models.CASCADE, primary_key=True, related_name="latest", verbose_name="señal"
    )
    time = models.DateTimeField("fecha de adquisición")
    value = models.FloatField("valor")
    quality = models.CharField("calidad", max_length=12, choices=Quality.choices)
    received_at = models.DateTimeField("recibida", auto_now=True)

    class Meta:
        verbose_name = "lectura actual"
        verbose_name_plural = "lecturas actuales"

    def __str__(self) -> str:
        return f"{self.signal} = {self.value}"
