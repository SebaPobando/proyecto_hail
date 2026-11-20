"""WebSocket /ws/updates: avisos de cambio de los proyectos visibles para el usuario.

Al conectar, el usuario queda suscrito a los proyectos que ve en ese momento
(`Project.objects.for_user`). Si cambian sus accesos, se aplica al reconectar;
los avisos no llevan datos, así que un acceso retirado no expone información.
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings

from apps.projects.models import Project

from .events import project_group

UNAUTHENTICATED = 4401


@database_sync_to_async
def visible_slugs(user) -> list[str]:
    return list(Project.objects.for_user(user).values_list("slug", flat=True))


class UpdatesConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=UNAUTHENTICATED)
            return
        self.groups_joined = [project_group(slug) for slug in await visible_slugs(user)]
        for group in self.groups_joined:
            await self.channel_layer.group_add(group, self.channel_name)
        await self.accept()
        # live=False: los avisos no cruzan procesos (sin Redis); la pantalla debe seguir consultando.
        await self.send_json({"type": "hello", "live": settings.REALTIME_LIVE})

    async def disconnect(self, code):
        for group in getattr(self, "groups_joined", []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        """El canal es de bajada: lo que envíe el navegador se ignora."""

    async def project_event(self, event):
        await self.send_json({"type": "event", "project": event["project"], "kind": event["kind"]})
