from django.contrib import admin
from django.urls import path

from config.api import api

admin.site.site_header = "Hail · Administración"
admin.site.site_title = "Hail"
admin.site.index_title = "Clientes, proyectos y accesos"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
