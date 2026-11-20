"""Avisos de cambio para las pantallas conectadas por WebSocket.

Un aviso solo dice "cambió algo de este tipo en este proyecto"; no lleva
datos. La pantalla vuelve a pedirlos por la API, que aplica los permisos de
siempre. Si Redis no está disponible, el aviso se pierde sin afectar la
operación: las pantallas igual consultan periódicamente.
"""

import logging
from typing import Literal

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

logger = logging.getLogger(__name__)

Kind = Literal["telemetry", "alarms", "work_items"]


def project_group(slug: str) -> str:
    return f"project.{slug}"


def notify(slug: str, kind: Kind) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(project_group(slug), {"type": "project.event", "project": slug, "kind": kind})
    except Exception as error:  # Redis caído o mal configurado: no debe detener la ingesta
        logger.warning("No se pudo enviar el aviso en vivo (%s/%s): %s", slug, kind, error)


def notify_on_commit(slug: str, *kinds: Kind) -> None:
    """Avisa cuando la transacción en curso se confirme (en seguida si no hay transacción)."""
    for kind in dict.fromkeys(kinds):
        transaction.on_commit(lambda kind=kind: notify(slug, kind))
