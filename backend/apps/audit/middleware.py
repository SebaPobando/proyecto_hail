from .context import current_actor


class CurrentActorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = current_actor.set(getattr(request, "user", None))
        try:
            return self.get_response(request)
        finally:
            current_actor.reset(token)
