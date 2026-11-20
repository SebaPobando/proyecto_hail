from apps.projects.models import Project
from apps.realtime.events import notify

from .evaluation import Evaluation, check_communication


def check_communication_and_notify(now=None) -> Evaluation:
    """Revisa la comunicación de los dispositivos y avisa a las pantallas de los proyectos afectados."""
    result = check_communication(now)
    for slug in Project.objects.filter(pk__in=result.projects).values_list("slug", flat=True):
        notify(slug, "alarms")
    return result
